import { Client } from "@upstash/qstash";
import { ACTIONS, MODES, MOODS, REPLIES, fill, repliesFor, type ModeId, type ReplyId } from "./catalog";
import { config } from "./config";
import * as db from "./db";
import { esc, replyMarkup, sendBigEmoji, sendToOwner, tg } from "./telegram";
import type { Req } from "./types";

const NAG_TEXTS = [
  "⏰ Напоминаю: {name} ждёт ответа",
  "⚠️ Ты всё ещё не ответил. {name} ждёт!",
  "🚨🚨🚨 ТЫ ИГНОРИШЬ {name}. Ответь немедленно!",
];

export type NewRequest = {
  kind: string;
  option?: string;
  text?: string;
  emoji?: string;
  location?: { lat: number; lon: number };
  couponTitle?: string;
};

export function describe(r: Req) {
  const name = config.herName;
  let line = `${r.emoji} <b>${esc(r.title)}</b>`;
  if (r.option) line += `\n— ${esc(r.option)}`;
  if (r.text) line += `\n«${esc(r.text)}»`;
  if (r.kind === "custom" || r.kind === "coupon") line = line.replace("<b>", `<b>${esc(name)}: `);
  return line;
}

async function modesFooter() {
  const { modes } = await db.getState();
  const active = (Object.keys(modes) as ModeId[]).filter((m) => modes[m]);
  if (!active.length) return "";
  return "\n\n" + active.map((m) => `${MODES[m].emoji} Режим «${MODES[m].label}»: ${MODES[m].hint}`).join("\n");
}

export async function createRequest(input: NewRequest): Promise<Req> {
  const name = config.herName;
  const now = Date.now();
  let emoji: string, title: string, option: string | undefined, text: string | undefined;

  if (input.kind === "custom") {
    text = input.text?.trim().slice(0, 500);
    if (!text) throw new Error("empty text");
    emoji = input.emoji?.slice(0, 8) || "💌";
    title = "просьба";
  } else if (input.kind === "coupon") {
    emoji = "🎟";
    title = `использует купон «${input.couponTitle}»`;
  } else {
    const def = ACTIONS[input.kind];
    if (!def) throw new Error("unknown action");
    emoji = def.emoji;
    title = fill(def.notify, name);
    if (def.options) {
      const opt = def.options.items.find((o) => o.id === input.option);
      if (opt) option = `${opt.emoji} ${opt.label}`;
    }
  }

  const req: Req = {
    id: db.newId(),
    kind: input.kind,
    emoji,
    title,
    option,
    text,
    location: input.location,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    nags: 0,
  };

  await sendBigEmoji(emoji);
  if (req.location) {
    await tg("sendLocation", { chat_id: config.ownerId, latitude: req.location.lat, longitude: req.location.lon });
  }
  const replies: ReplyId[] = input.kind === "coupon" ? ["done"] : repliesFor(input.kind);
  const msg = await sendToOwner(describe(req) + (await modesFooter()), replyMarkup(req.id, replies));
  req.messageId = msg?.message_id;
  await db.addRequest(req);
  await scheduleNag(req.id, 1);
  return req;
}

export async function applyReply(reqId: string, reply: ReplyId): Promise<Req | null> {
  const r = REPLIES[reply];
  if (!r) return null;
  const updated = await db.updateRequest(reqId, (req) => ({ ...req, status: r.status, reply }));
  if (!updated) return null;
  if (updated.messageId) {
    // Пока не «сделано» — оставляем кнопки завершения.
    const rest = r.status === "done" ? [] : repliesFor(updated.kind).filter((x) => REPLIES[x].status === "done");
    await tg("editMessageText", {
      chat_id: config.ownerId,
      message_id: updated.messageId,
      text: `${describe(updated)}\n\n→ ${r.emoji} ${r.label}`,
      parse_mode: "HTML",
      reply_markup: rest.length ? replyMarkup(updated.id, rest) : undefined,
    });
  }
  return updated;
}

async function scheduleNag(reqId: string, n: number) {
  const token = process.env.QSTASH_TOKEN;
  if (!token || !config.remindMinutes) return;
  try {
    await new Client({ token }).publishJSON({
      url: `${config.appUrl}/api/remind`,
      body: { id: reqId, n },
      delay: config.remindMinutes * 60,
    });
  } catch (e) {
    console.error("qstash publish failed", e);
  }
}

export async function nag(reqId: string, n: number) {
  const req = (await db.getRequests()).find((r) => r.id === reqId);
  if (!req || req.status !== "pending") return;
  if (n > NAG_TEXTS.length) {
    await db.updateRequest(reqId, (r) => (r.status === "pending" ? { ...r, status: "ignored" } : null));
    return;
  }
  await db.updateRequest(reqId, (r) => ({ ...r, nags: n }));
  await sendToOwner(`${fill(NAG_TEXTS[n - 1], esc(config.herName))}\n\n${describe(req)}`, replyMarkup(req.id, repliesFor(req.kind)));
  await scheduleNag(reqId, n + 1);
}

export async function setMood(mood: number) {
  const m = Math.max(1, Math.min(10, Math.round(mood)));
  const state = await db.getState();
  if (state.mood === m) return state;
  const next = { ...state, mood: m, moodAt: Date.now() };
  await db.setState(next);
  await sendToOwner(`${MOODS[m - 1]} Настроение ${esc(config.herName)}: <b>${m}/10</b>`);
  return next;
}

export async function setMode(mode: ModeId, on: boolean) {
  if (!MODES[mode]) throw new Error("unknown mode");
  const state = await db.getState();
  const modes = { ...state.modes };
  if (on) modes[mode] = Date.now();
  else delete modes[mode];
  const next = { ...state, modes };
  await db.setState(next);
  const m = MODES[mode];
  await sendToOwner(
    on
      ? `${m.emoji} ${esc(config.herName)} включила режим <b>«${m.label}»</b> (${m.hint})`
      : `✨ ${esc(config.herName)} выключила режим «${m.label}»`,
  );
  return next;
}

export async function statusText() {
  const [state, requests, coupons] = await Promise.all([db.getState(), db.getRequests(), db.getCoupons()]);
  const name = esc(config.herName);
  const lines = [`<b>Статус: ${name}</b>`];
  lines.push(state.mood ? `Настроение: ${MOODS[state.mood - 1]} ${state.mood}/10` : "Настроение: не указано");
  for (const m of Object.keys(state.modes) as ModeId[]) lines.push(`${MODES[m].emoji} Режим «${MODES[m].label}»`);
  const guilts = requests.filter((r) => r.kind === "guilty" && r.status !== "done").length;
  lines.push(`😡 Открытых провинностей: ${guilts}`);
  const pending = requests.filter((r) => r.status === "pending");
  lines.push(`⏳ Без ответа: ${pending.length}`);
  for (const r of pending.slice(0, 10)) lines.push(`  • ${r.emoji} ${esc(r.title)}${r.option ? ` (${esc(r.option)})` : ""}`);
  lines.push(`🎟 Неиспользованных купонов: ${coupons.filter((c) => !c.usedAt).length}`);
  return lines.join("\n");
}

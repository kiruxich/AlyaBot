import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { REPLIES, type ReplyId } from "./catalog";

type InlineButton = { text: string; callback_data?: string; web_app?: { url: string }; url?: string };
export type Markup = { inline_keyboard: InlineButton[][] };

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    console.error(`telegram ${method} failed:`, json.description);
    return null;
  }
  return json.result ?? null;
}

export const sendToOwner = (text: string, markup?: Markup) =>
  tg<{ message_id: number }>("sendMessage", {
    chat_id: config.ownerId,
    text,
    parse_mode: "HTML",
    reply_markup: markup,
  });

/** Одиночный эмодзи Telegram показывает крупным и анимированным. */
export const sendBigEmoji = (emoji: string) => tg("sendMessage", { chat_id: config.ownerId, text: emoji });

export function replyMarkup(reqId: string, replies: ReplyId[]): Markup {
  const buttons = replies.map((r) => ({
    text: `${REPLIES[r].emoji} ${REPLIES[r].label}`,
    callback_data: `r:${reqId}:${r}`,
  }));
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

export const openAppMarkup = (text = "💖 Открыть"): Markup => ({
  inline_keyboard: [[{ text, web_app: { url: config.appUrl } }]],
});

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MAX_AGE_SEC = 24 * 60 * 60;

/** Проверка подписи Telegram.WebApp.initData. Возвращает id пользователя. */
export function verifyInitData(initData: string): number | null {
  if (!initData || !config.botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;
  try {
    return Number(JSON.parse(params.get("user") ?? "{}").id) || null;
  } catch {
    return null;
  }
}

export const yandexMapsUrl = (lat: number, lon: number) => `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;

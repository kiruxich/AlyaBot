import { NextResponse, type NextRequest } from "next/server";
import type { ReplyId } from "@/lib/catalog";
import { REPLIES } from "@/lib/catalog";
import { config, roleOf } from "@/lib/config";
import { applyReply, statusText } from "@/lib/service";
import { esc, openAppMarkup, tg } from "@/lib/telegram";

type Update = {
  message?: { chat: { id: number }; from?: { id: number }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string };
};

const ok = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== config.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as Update;

  if (update.callback_query) {
    const cq = update.callback_query;
    const [kind, id, reply] = (cq.data ?? "").split(":");
    if (roleOf(cq.from.id) !== "owner" || kind !== "r" || !(reply in REPLIES)) {
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      return ok();
    }
    const updated = await applyReply(id, reply as ReplyId);
    const r = REPLIES[reply as ReplyId];
    await tg("answerCallbackQuery", {
      callback_query_id: cq.id,
      text: updated ? `${r.emoji} ${r.label} — ${config.herName} увидит` : "Запрос не найден",
    });
    return ok();
  }

  const msg = update.message;
  if (!msg?.from) return ok();
  const role = roleOf(msg.from.id);
  if (!role) {
    await tg("sendMessage", { chat_id: msg.chat.id, text: "Этот бот приватный 🔒" });
    return ok();
  }

  const text = msg.text ?? "";
  if (text.startsWith("/status") && role === "owner") {
    await tg("sendMessage", { chat_id: msg.chat.id, text: await statusText(), parse_mode: "HTML", reply_markup: openAppMarkup("📊 Открыть панель") });
    return ok();
  }

  const name = esc(config.herName);
  const intro =
    role === "her"
      ? `Привет, ${name} ❄️💖\n\nЗдесь можно одной кнопкой попросить что угодно: забрать тебя, цветочки, вкусняшку, обнимашки… или сообщить, что он виноват 😡\n\nОн получит уведомление сразу, а его ответ появится в приложении.`
      : `Панель для тебя 🫡\n\nСюда приходят просьбы от ${name}. Отвечай кнопками под уведомлениями.\n/status — сводка: настроение, режимы, провинности.`;
  await tg("sendMessage", { chat_id: msg.chat.id, text: intro, parse_mode: "HTML", reply_markup: openAppMarkup() });
  return ok();
}

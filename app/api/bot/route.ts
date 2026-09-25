import { after, NextResponse, type NextRequest } from "next/server";
import type { ReplyId } from "@/lib/catalog";
import { REPLIES } from "@/lib/catalog";
import { config, roleOf } from "@/lib/config";
import { applyReply, checkReminders, statusText } from "@/lib/service";
import { esc, openAppMarkup, tg } from "@/lib/telegram";

type Update = {
  message?: { chat: { id: number }; from?: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

const ok = () => NextResponse.json({ ok: true });

const statusMarkup = () => ({
  inline_keyboard: [
    [{ text: "🔄 Обновить", callback_data: "status:refresh" }],
    ...openAppMarkup("📊 Открыть панель").inline_keyboard,
  ],
});

export async function POST(req: NextRequest) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== config.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as Update;
  after(() => checkReminders().catch(console.error));

  if (update.callback_query) {
    const cq = update.callback_query;
    const [kind, id, reply] = (cq.data ?? "").split(":");
    if (roleOf(cq.from.id) === "owner" && kind === "status") {
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      const body = { text: await statusText(), parse_mode: "HTML", reply_markup: statusMarkup() };
      // «Обновить» правит сводку на месте, кнопка под описанием шлёт новую.
      if (id === "refresh" && cq.message) {
        await tg("editMessageText", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, ...body });
      } else {
        await tg("sendMessage", { chat_id: cq.from.id, ...body });
      }
      return ok();
    }
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
    await tg("sendMessage", { chat_id: msg.chat.id, text: await statusText(), parse_mode: "HTML", reply_markup: statusMarkup() });
    return ok();
  }

  // Кнопка меню ставится только в ваших чатах; до первого /start Telegram её не принимает.
  await tg("setChatMenuButton", {
    chat_id: msg.chat.id,
    menu_button: { type: "web_app", text: "💖 Открыть", web_app: { url: config.appUrl } },
  });

  const name = esc(config.herName);
  const intro =
    role === "her"
      ? `Привет, ${name} ❄️💖\n\nЗдесь можно одной кнопкой попросить что угодно: забрать тебя, цветочки, вкусняшку, обнимашки… или сообщить, что он виноват 😡\n\nОн получит уведомление сразу, а его ответ появится в приложении.`
      : `Панель для тебя 🫡\n\nСюда приходят просьбы от ${name}. Отвечай кнопками под уведомлениями.\nКнопка «📊 Статус» — сводка: настроение, режимы, провинности.`;
  const markup =
    role === "owner"
      ? { inline_keyboard: [...openAppMarkup().inline_keyboard, [{ text: "📊 Статус", callback_data: "status" }]] }
      : openAppMarkup();
  await tg("sendMessage", { chat_id: msg.chat.id, text: intro, parse_mode: "HTML", reply_markup: markup });
  return ok();
}

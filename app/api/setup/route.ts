import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { tg } from "@/lib/telegram";

// Разовая настройка: GET /api/setup?secret=<WEBHOOK_SECRET>
export async function GET(req: NextRequest) {
  if (!config.webhookSecret || req.nextUrl.searchParams.get("secret") !== config.webhookSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const results = {
    webhook: await tg("setWebhook", {
      url: `${config.appUrl}/api/bot`,
      secret_token: config.webhookSecret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
    // Для всех — ничего: ни кнопки приложения, ни команд. Всё только в ваших двух чатах.
    defaultMenu: await tg("setChatMenuButton", { menu_button: { type: "default" } }),
    defaultCommands: await tg("deleteMyCommands", {}),
    private: await Promise.all(
      [config.ownerId, config.herId].map(async (chat_id) => ({
        menu: await tg("setChatMenuButton", {
          chat_id,
          menu_button: { type: "web_app", text: "💖 Открыть", web_app: { url: config.appUrl } },
        }),
        commands: await tg("setMyCommands", {
          scope: { type: "chat", chat_id },
          commands:
            chat_id === config.ownerId
              ? [
                  { command: "start", description: "Открыть приложение" },
                  { command: "status", description: "Сводка" },
                ]
              : [{ command: "start", description: "Открыть приложение" }],
        }),
      })),
    ),
  };
  return NextResponse.json({ appUrl: config.appUrl, ...results });
}

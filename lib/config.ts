export const config = {
  botToken: process.env.BOT_TOKEN || "",
  ownerId: Number(process.env.OWNER_ID || 0),
  herId: Number(process.env.HER_ID || 0),
  herName: process.env.HER_NAME || "Снежинка",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  remindMinutes: Number(process.env.REMIND_MINUTES || 10),
  appUrl:
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  /** Только для локальной разработки вне Telegram. */
  devUserId: process.env.NODE_ENV !== "production" ? Number(process.env.DEV_USER_ID || 0) : 0,
};

export function roleOf(userId: number): "owner" | "her" | null {
  if (userId && userId === config.ownerId) return "owner";
  if (userId && userId === config.herId) return "her";
  return null;
}

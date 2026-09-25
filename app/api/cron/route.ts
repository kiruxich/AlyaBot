import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { checkReminders } from "@/lib/service";

export const dynamic = "force-dynamic";

// Пинг по расписанию из GitHub Actions: Authorization: Bearer <WEBHOOK_SECRET>
export async function GET(req: NextRequest) {
  if (!config.webhookSecret || req.headers.get("authorization") !== `Bearer ${config.webhookSecret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ nagged: await checkReminders() });
}

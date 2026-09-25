import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { nag } from "@/lib/service";

// Вызывается QStash с задержкой: напоминания о неотвеченных просьбах.
export async function POST(req: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const body = await req.text();
  const valid = await new Receiver({ currentSigningKey, nextSigningKey })
    .verify({ signature: req.headers.get("upstash-signature") ?? "", body })
    .catch(() => false);
  if (!valid) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const { id, n } = JSON.parse(body) as { id: string; n: number };
  await nag(id, n);
  return NextResponse.json({ ok: true });
}

import { after, NextResponse, type NextRequest } from "next/server";
import { MODES, REPLIES, type ModeId, type ReplyId } from "@/lib/catalog";
import { config, roleOf } from "@/lib/config";
import * as db from "@/lib/db";
import { applyReply, checkReminders, createRequest, setMode, setMood } from "@/lib/service";
import { esc, sendToOwner } from "@/lib/telegram";
import { verifyInitData } from "@/lib/telegram";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

function auth(req: NextRequest) {
  const initData = req.headers.get("x-init-data") ?? "";
  const userId = verifyInitData(initData) ?? (initData ? null : config.devUserId || null);
  return userId ? roleOf(userId) : null;
}

const deny = () => NextResponse.json({ error: "forbidden" }, { status: 403 });
const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

async function load(role: "owner" | "her"): Promise<AppData> {
  const [state, requests, coupons, wishlist] = await Promise.all([
    db.getState(),
    db.getRequests(),
    db.getCoupons(),
    db.getWishlist(),
  ]);
  return {
    role,
    name: config.herName,
    state,
    requests: requests.slice(0, 60),
    coupons,
    // Бронь подарков — секрет от неё.
    wishlist: role === "her" ? wishlist.map(({ reserved: _, ...w }) => w) : wishlist,
  };
}

export async function GET(req: NextRequest) {
  const role = auth(req);
  if (!role) return deny();
  // Попутно проверяем напоминания — страховка к cron.
  after(() => checkReminders().catch(console.error));
  return NextResponse.json(await load(role));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const role = auth(req);
  if (!role) return deny();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const owner = role === "owner";

  switch (body.op) {
    case "request": {
      const loc = body.location as { lat?: unknown; lon?: unknown } | undefined;
      const location =
        loc && typeof loc.lat === "number" && typeof loc.lon === "number" ? { lat: loc.lat, lon: loc.lon } : undefined;
      try {
        await createRequest({
          kind: str(body.kind, 32),
          option: str(body.option, 32) || undefined,
          text: str(body.text, 500) || undefined,
          emoji: str(body.emoji, 8) || undefined,
          location,
        });
      } catch (e) {
        return bad((e as Error).message);
      }
      break;
    }
    case "mood":
      if (typeof body.mood !== "number") return bad("mood");
      await setMood(body.mood);
      break;
    case "mode":
      if (!(String(body.mode) in MODES)) return bad("mode");
      await setMode(body.mode as ModeId, Boolean(body.on));
      break;
    case "reply":
      if (!owner) return deny();
      if (!(String(body.reply) in REPLIES)) return bad("reply");
      await applyReply(str(body.id, 16), body.reply as ReplyId);
      break;
    case "coupon.create": {
      if (!owner) return deny();
      const title = str(body.title, 80);
      if (!title) return bad("title");
      const coupons = await db.getCoupons();
      await db.setCoupons([{ id: db.newId(), title, createdAt: Date.now() }, ...coupons]);
      break;
    }
    case "coupon.delete": {
      if (!owner) return deny();
      const coupons = await db.getCoupons();
      await db.setCoupons(coupons.filter((c) => c.id !== body.id));
      break;
    }
    case "coupon.use": {
      const coupons = await db.getCoupons();
      const c = coupons.find((x) => x.id === body.id && !x.usedAt);
      if (!c) return bad("coupon");
      c.usedAt = Date.now();
      await db.setCoupons(coupons);
      await createRequest({ kind: "coupon", couponTitle: c.title });
      break;
    }
    case "wish.add": {
      const title = str(body.title, 120);
      if (!title) return bad("title");
      const rawUrl = str(body.url, 500);
      const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;
      const note = str(body.note, 200) || undefined;
      const list = await db.getWishlist();
      await db.setWishlist([{ id: db.newId(), title, url, note, createdAt: Date.now() }, ...list]);
      if (!owner) {
        const link = url ? `\n<a href="${esc(url)}">ссылка</a>` : "";
        await sendToOwner(`🎁 ${esc(config.herName)} добавила в вишлист: <b>${esc(title)}</b>${note ? `\n${esc(note)}` : ""}${link}`);
      }
      break;
    }
    case "wish.delete": {
      const list = await db.getWishlist();
      await db.setWishlist(list.filter((w) => w.id !== body.id));
      break;
    }
    case "wish.reserve": {
      if (!owner) return deny();
      const list = await db.getWishlist();
      await db.setWishlist(list.map((w) => (w.id === body.id ? { ...w, reserved: Boolean(body.reserved) } : w)));
      break;
    }
    default:
      return bad("op");
  }
  return NextResponse.json(await load(role));
}

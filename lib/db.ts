import { neon } from "@neondatabase/serverless";
import type { Coupon, Req, State, Wish } from "./types";

// Храним всё маленькими JSON-документами в одной таблице: пользователей двое, гонок нет.

type KV = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
};

function makeKV(): KV {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    // Своя таблица с префиксом — базу можно делить с другими проектами.
    const ready = sql`CREATE TABLE IF NOT EXISTS alya_kv (key text PRIMARY KEY, value jsonb NOT NULL)`;
    return {
      async get<T>(key: string) {
        await ready;
        const rows = (await sql`SELECT value FROM alya_kv WHERE key = ${key}`) as { value: T }[];
        return rows[0]?.value ?? null;
      },
      async set(key: string, value: unknown) {
        await ready;
        await sql`INSERT INTO alya_kv (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      },
    };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Database is not configured (POSTGRES_URL)");
  // Локальная разработка без базы.
  const g = globalThis as { __mem?: Map<string, unknown> };
  const mem = (g.__mem ??= new Map());
  return {
    async get<T>(key: string) {
      return (mem.get(key) as T) ?? null;
    },
    async set(key: string, value: unknown) {
      mem.set(key, structuredClone(value));
    },
  };
}

// Лениво: иначе сборка на Vercel падает без переменных окружения.
let kvInstance: KV | null = null;
const kv: KV = {
  get: (key) => (kvInstance ??= makeKV()).get(key),
  set: (key, value) => (kvInstance ??= makeKV()).set(key, value),
};
const MAX_REQUESTS = 150;

export const newId = () => Math.random().toString(36).slice(2, 10);

export async function getState(): Promise<State> {
  return (await kv.get<State>("state")) ?? { modes: {} };
}
export const setState = (s: State) => kv.set("state", s);

export async function getRequests(): Promise<Req[]> {
  return (await kv.get<Req[]>("requests")) ?? [];
}

export async function addRequest(r: Req) {
  const list = await getRequests();
  await kv.set("requests", [r, ...list].slice(0, MAX_REQUESTS));
}

export async function updateRequest(id: string, patch: (r: Req) => Req | null) {
  const list = await getRequests();
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const next = patch(list[i]);
  if (!next) return null;
  list[i] = { ...next, updatedAt: Date.now() };
  await kv.set("requests", list);
  return list[i];
}

export async function getCoupons(): Promise<Coupon[]> {
  return (await kv.get<Coupon[]>("coupons")) ?? [];
}
export const setCoupons = (c: Coupon[]) => kv.set("coupons", c);

export async function getWishlist(): Promise<Wish[]> {
  return (await kv.get<Wish[]>("wishlist")) ?? [];
}
export const setWishlist = (w: Wish[]) => kv.set("wishlist", w);

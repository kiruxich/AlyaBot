import { Redis } from "@upstash/redis";
import type { Coupon, Req, State, Wish } from "./types";

// Храним всё маленькими JSON-документами: пользователей двое, гонок нет.

type KV = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
};

function makeKV(): KV {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new Redis({ url, token });
  if (process.env.NODE_ENV === "production") throw new Error("Redis is not configured");
  // Локальная разработка без Redis.
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
// Префикс — чтобы можно было делить базу с другими проектами.
const PREFIX = "alya:";
let kvInstance: KV | null = null;
const kv: KV = {
  get: (key) => (kvInstance ??= makeKV()).get(PREFIX + key),
  set: (key, value) => (kvInstance ??= makeKV()).set(PREFIX + key, value),
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

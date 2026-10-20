// Перенос данных из Neon (таблица alya_kv) в Upstash Redis.
// Запуск: POSTGRES_URL=... UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/neon-to-redis.mjs
import { neon } from "@neondatabase/serverless";

const { POSTGRES_URL, UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
if (!POSTGRES_URL || !url || !token) throw new Error("Нужны POSTGRES_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN");

const rows = await neon(POSTGRES_URL)`SELECT key, value FROM alya_kv`;
for (const { key, value } of rows) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(["SET", `alya:${key}`, JSON.stringify(value)]),
  });
  if (!res.ok) throw new Error(`${key}: ${res.status} ${await res.text()}`);
  console.log(`✓ ${key}`);
}

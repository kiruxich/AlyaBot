"use client";

import { useEffect, useState } from "react";
import { REPLIES, repliesFor } from "@/lib/catalog";
import type { Coupon, Req, Wish } from "@/lib/types";
import { ask, haptic } from "@/lib/webapp";

export type Run = (op: string, payload?: Record<string, unknown>, okText?: string) => Promise<boolean>;

const STATUS_LABEL: Record<Req["status"], string> = {
  pending: "⏳ ждёт ответа",
  accepted: "💬 ответил",
  done: "✅ выполнено",
  ignored: "👀 проигнорировано",
};

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function RequestCard({ r, run, owner }: { r: Req; run: Run; owner: boolean }) {
  const reply = r.reply ? REPLIES[r.reply] : null;
  const canReply = owner && r.status !== "done";
  const replies = r.kind === "coupon" ? (["done"] as const) : repliesFor(r.kind);
  return (
    <div className="card hist">
      <span className="emo">{r.emoji}</span>
      <div className="body">
        <div className="title">
          {r.kind === "custom" || r.kind === "coupon" ? `${r.title[0].toUpperCase()}${r.title.slice(1)}` : r.title}
        </div>
        {r.option && <div className="muted">{r.option}</div>}
        {r.text && <div className="muted">«{r.text}»</div>}
        {r.location && (
          <a className="muted" href={`https://yandex.ru/maps/?pt=${r.location.lon},${r.location.lat}&z=17&l=map`} target="_blank" rel="noreferrer">
            📍 геолокация
          </a>
        )}
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className={`badge ${r.status}`}>{reply ? `${reply.emoji} ${reply.label}` : STATUS_LABEL[r.status]}</span>
          <span className="muted" style={{ marginTop: 6 }}>
            {timeAgo(r.createdAt)}
          </span>
        </div>
        {canReply && (
          <div className="replies">
            {replies.map((id) => (
              <button key={id} className="btn small ghost" onClick={() => run("reply", { id: r.id, reply: id }, "Ответ отправлен")}>
                {REPLIES[id].emoji} {REPLIES[id].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function History({ requests, run, owner }: { requests: Req[]; run: Run; owner: boolean }) {
  if (!requests.length) return <Empty emoji="📜" text="Пока ничего не было" />;
  return (
    <div className="stack">
      {requests.map((r) => (
        <RequestCard key={r.id} r={r} run={run} owner={owner} />
      ))}
    </div>
  );
}

export function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="empty">
      <span className="emo">{emoji}</span>
      {text}
    </div>
  );
}

export function CouponList({ coupons, run, owner }: { coupons: Coupon[]; run: Run; owner: boolean }) {
  const [title, setTitle] = useState("");
  const active = coupons.filter((c) => !c.usedAt);
  const used = coupons.filter((c) => c.usedAt);
  return (
    <div>
      {owner && (
        <div className="card stack" style={{ marginBottom: 14 }}>
          <h3>Выдать купон</h3>
          <input className="field" placeholder="Например: «1 любое желание»" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {["1 любое желание", "Выбор фильма", "Завтрак в постель", "Массаж 30 минут", "Прощение без вопросов"].map((t) => (
              <button key={t} className="btn small ghost" onClick={() => setTitle(t)}>
                {t}
              </button>
            ))}
          </div>
          <button
            className="btn block"
            disabled={!title.trim()}
            onClick={async () => {
              if (await run("coupon.create", { title }, "Купон выдан 🎟")) setTitle("");
            }}
          >
            🎟 Выдать
          </button>
        </div>
      )}
      {!coupons.length && <Empty emoji="🎟" text={owner ? "Купонов пока нет" : "Купонов пока нет. Намекни ему 😉"} />}
      {active.map((c) => (
        <div key={c.id} className="coupon">
          <div className="row spread">
            <b>🎟 {c.title}</b>
            {owner ? (
              <button className="btn small ghost" onClick={() => run("coupon.delete", { id: c.id }, "Купон удалён")}>
                ✕
              </button>
            ) : (
              <button
                className="btn small"
                onClick={async () => {
                  haptic.tap();
                  if (await ask(`Использовать купон «${c.title}»?`)) run("coupon.use", { id: c.id }, "Купон использован! 💌");
                }}
              >
                Использовать
              </button>
            )}
          </div>
        </div>
      ))}
      {used.length > 0 && <div className="section-title">Использованные</div>}
      {used.map((c) => (
        <div key={c.id} className="coupon used">
          <b>🎟 {c.title}</b>
          <div className="muted">использован {timeAgo(c.usedAt!)}</div>
        </div>
      ))}
    </div>
  );
}

export function Wishlist({ wishlist, run, owner }: { wishlist: Wish[]; run: Run; owner: boolean }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  return (
    <div>
      {!owner && (
        <div className="card stack" style={{ marginBottom: 14 }}>
          <h3>Хочу вот это 🎁</h3>
          <input className="field" placeholder="Что хочешь?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <input className="field" placeholder="Ссылка (необязательно)" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
          <input className="field" placeholder="Размер, цвет, заметка…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <button
            className="btn block"
            disabled={!title.trim()}
            onClick={async () => {
              if (await run("wish.add", { title, url, note }, "Добавлено в вишлист 🎁")) {
                setTitle("");
                setUrl("");
                setNote("");
              }
            }}
          >
            Добавить
          </button>
        </div>
      )}
      {!wishlist.length && <Empty emoji="🎁" text="Вишлист пуст" />}
      <div className="stack">
        {wishlist.map((w) => (
          <div key={w.id} className="card">
            <div className="row spread" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ overflowWrap: "anywhere" }}>{w.title}</h3>
                {w.note && <div className="muted">{w.note}</div>}
                {w.url && (
                  <a className="muted" href={w.url} target="_blank" rel="noreferrer">
                    🔗 открыть ссылку
                  </a>
                )}
              </div>
              <button className="btn small ghost" onClick={async () => (await ask("Удалить из вишлиста?")) && run("wish.delete", { id: w.id })}>
                ✕
              </button>
            </div>
            {owner && (
              <button
                className={`btn small ${w.reserved ? "" : "ghost"}`}
                style={{ marginTop: 10 }}
                onClick={() => run("wish.reserve", { id: w.id, reserved: !w.reserved })}
              >
                {w.reserved ? "🤫 Я это дарю (она не видит)" : "Забронировать тайно"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Падающие снежинки на фоне. */
export function Snow() {
  const [flakes, setFlakes] = useState<{ left: number; dur: number; delay: number; size: number }[]>([]);
  useEffect(() => {
    setFlakes(
      Array.from({ length: 14 }, () => ({
        left: Math.random() * 100,
        dur: 9 + Math.random() * 10,
        delay: -Math.random() * 18,
        size: 10 + Math.random() * 14,
      })),
    );
  }, []);
  return (
    <>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="snow"
          aria-hidden
          style={{ left: `${f.left}%`, fontSize: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
        >
          ❄️
        </span>
      ))}
    </>
  );
}

/** Салют из эмодзи из точки нажатия. */
export function burst(x: number, y: number, emojis: string[]) {
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    el.className = "particle";
    el.textContent = emojis[i % emojis.length];
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 80 + Math.random() * 90;
    el.style.left = `${x - 13}px`;
    el.style.top = `${y - 13}px`;
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
    el.style.setProperty("--rot", `${(Math.random() - 0.5) * 120}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

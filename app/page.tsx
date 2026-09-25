"use client";

import { useCallback, useEffect, useState } from "react";
import { MeTab, RequestsTab } from "@/components/HerView";
import { StatusTab } from "@/components/OwnerView";
import { CouponList, History, Snow, Wishlist, type Run } from "@/components/shared";
import { MODES, MOODS, type ModeId } from "@/lib/catalog";
import type { AppData } from "@/lib/types";
import { api, haptic, webApp } from "@/lib/webapp";

const HER_TABS = [
  { id: "requests", emoji: "💌", label: "Просьбы" },
  { id: "me", emoji: "🌡", label: "Я" },
  { id: "coupons", emoji: "🎟", label: "Купоны" },
  { id: "wishlist", emoji: "🎁", label: "Вишлист" },
  { id: "history", emoji: "📜", label: "История" },
];

const OWNER_TABS = [
  { id: "status", emoji: "📊", label: "Статус" },
  { id: "coupons", emoji: "🎟", label: "Купоны" },
  { id: "wishlist", emoji: "🎁", label: "Вишлист" },
  { id: "history", emoji: "📜", label: "История" },
];

export default function Page() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setData(await api());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const wa = webApp();
    if (wa) {
      wa.ready();
      wa.expand();
      wa.disableVerticalSwipes?.();
      const dark = wa.colorScheme === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      wa.setHeaderColor?.(dark ? "#1d1320" : "#fff4f8");
      wa.setBackgroundColor?.(dark ? "#1d1320" : "#fff4f8");
    }
    refresh();
    // Подтягиваем его ответы, пока приложение открыто.
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const run: Run = useCallback(
    async (op, payload = {}, okText) => {
      try {
        setData(await api(op, payload));
        haptic.success();
        if (okText) showToast(okText);
        return true;
      } catch {
        haptic.error();
        showToast("Не получилось 😿 Попробуй ещё раз");
        return false;
      }
    },
    [showToast],
  );

  if (error === "forbidden") {
    return (
      <main className="app">
        <div className="empty" style={{ paddingTop: 120 }}>
          <span className="emo">🔒</span>
          Это приватное приложение. Открой его из бота.
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app">
        <div className="empty" style={{ paddingTop: 140 }}>
          <span className="emo">❄️</span>
          {error ? "Нет связи, пробую ещё…" : "Загружаю…"}
        </div>
      </main>
    );
  }

  const owner = data.role === "owner";
  const tabs = owner ? OWNER_TABS : HER_TABS;
  const current = tab ?? tabs[0].id;
  const guilts = data.requests.filter((r) => r.kind === "guilty" && r.status !== "done").length;
  const modes = (Object.keys(data.state.modes) as ModeId[]).filter((m) => data.state.modes[m]);
  const pending = data.requests.filter((r) => r.status === "pending").length;

  return (
    <main className="app">
      <Snow />
      <header className="hero">
        <h1>{owner ? `Пульт: ${data.name} ❄️` : `Привет, ${data.name} ❄️`}</h1>
        <p>{owner ? "Всё, что ей нужно, прямо здесь" : "Чего хочется? Он уже на связи 💖"}</p>
        <div className="chips">
          {data.state.mood && (
            <span className="chip">
              {MOODS[data.state.mood - 1]} {data.state.mood}/10
            </span>
          )}
          {guilts > 0 && <span className="chip hot">😡 провинностей: {guilts}</span>}
          {pending > 0 && <span className="chip">⏳ без ответа: {pending}</span>}
          {modes.map((m) => (
            <span key={m} className="chip">
              {MODES[m].emoji} {MODES[m].label}
            </span>
          ))}
        </div>
      </header>

      {current === "requests" && <RequestsTab data={data} run={run} />}
      {current === "me" && <MeTab data={data} run={run} />}
      {current === "status" && <StatusTab data={data} run={run} />}
      {current === "coupons" && <CouponList coupons={data.coupons} run={run} owner={owner} />}
      {current === "wishlist" && <Wishlist wishlist={data.wishlist} run={run} owner={owner} />}
      {current === "history" && <History requests={data.requests} run={run} owner={owner} />}

      <nav className="nav">
        <div className="nav-inner">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-current={current === t.id ? "page" : undefined}
              onClick={() => {
                haptic.select();
                setTab(t.id);
                window.scrollTo({ top: 0 });
              }}
            >
              <span className="emo">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

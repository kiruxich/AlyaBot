"use client";

import type { AppData } from "./types";

// Минимальные типы Telegram.WebApp — только то, что используем.
type TgWebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  LocationManager?: {
    isInited: boolean;
    isLocationAvailable: boolean;
    init(cb?: () => void): void;
    getLocation(cb: (data: { latitude: number; longitude: number } | null) => void): void;
  };
  onEvent?(event: string, cb: () => void): void;
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  isVersionAtLeast?(version: string): boolean;
};

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

export const webApp = () => (typeof window !== "undefined" ? window.Telegram?.WebApp : undefined);

export const haptic = {
  tap: () => webApp()?.HapticFeedback?.impactOccurred("medium"),
  select: () => webApp()?.HapticFeedback?.selectionChanged(),
  success: () => webApp()?.HapticFeedback?.notificationOccurred("success"),
  error: () => webApp()?.HapticFeedback?.notificationOccurred("error"),
};

export async function api(op?: string, payload: Record<string, unknown> = {}): Promise<AppData> {
  const res = await fetch("/api/app", {
    method: op ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-init-data": webApp()?.initData ?? "" },
    body: op ? JSON.stringify({ op, ...payload }) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(res.status === 403 ? "forbidden" : `http ${res.status}`);
  return res.json();
}

/** Геолокация: сначала через Telegram, потом через браузер. null — если не вышло. */
export function getLocation(timeoutMs = 10000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { lat: number; lon: number } | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    setTimeout(() => finish(null), timeoutMs);

    const browser = () => {
      if (!navigator.geolocation) return finish(null);
      navigator.geolocation.getCurrentPosition(
        (p) => finish({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: timeoutMs - 500 },
      );
    };

    const lm = webApp()?.LocationManager;
    if (!lm) return browser();
    const ask = () => {
      if (!lm.isLocationAvailable) return browser();
      lm.getLocation((d) => (d ? finish({ lat: d.latitude, lon: d.longitude }) : browser()));
    };
    if (lm.isInited) ask();
    else lm.init(ask);
  });
}

/** Нативный confirm Telegram, в браузере — обычный. */
export function ask(message: string): Promise<boolean> {
  const wa = webApp();
  if (wa?.showConfirm && wa.initData && wa.isVersionAtLeast?.("6.2")) {
    return new Promise((resolve) => wa.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CUSTOM_EMOJIS, MODES, MOODS, SECTIONS, type ActionDef, type ModeId } from "@/lib/catalog";
import type { AppData } from "@/lib/types";
import { getLocation, haptic } from "@/lib/webapp";
import { burst, type Run } from "./shared";

type SheetState = { action: ActionDef } | { custom: true } | null;

export function RequestsTab({ data, run }: { data: AppData; run: Run }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [option, setOption] = useState<string | null>(null);
  const [withLocation, setWithLocation] = useState(true);
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(CUSTOM_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const lastTap = useRef({ x: innerWidthSafe() / 2, y: 300 });

  const open = (s: SheetState, e: React.MouseEvent) => {
    lastTap.current = { x: e.clientX, y: e.clientY };
    haptic.tap();
    setOption(null);
    setSheet(s);
  };

  const send = async () => {
    if (!sheet) return;
    setBusy(true);
    let ok: boolean;
    let emojis: string[];
    if ("custom" in sheet) {
      ok = await run("request", { kind: "custom", text, emoji }, "Отправлено 💌");
      emojis = [emoji, "💖", "✨"];
      if (ok) setText("");
    } else {
      const a = sheet.action;
      const location = a.location && withLocation ? await getLocation() : undefined;
      ok = await run(
        "request",
        { kind: a.id, option: option ?? undefined, location: location ?? undefined },
        a.location && withLocation && !location ? "Отправлено, но без геолокации 📍" : "Отправлено 💌",
      );
      emojis = [a.emoji, "💖", "✨"];
    }
    setBusy(false);
    if (ok) {
      setSheet(null);
      burst(lastTap.current.x, lastTap.current.y, emojis);
    }
  };

  const action = sheet && "action" in sheet ? sheet.action : null;
  const needsOption = Boolean(action?.options) && !option;

  return (
    <>
      {SECTIONS.map((s, si) => (
        <section key={s.id}>
          <div className="section-title">{s.title}</div>
          <div className="grid">
            {s.actions.map((a) => (
              <button
                key={a.id}
                className={`tile ${si === 0 ? "big" : ""} ${a.id === "guilty" ? "angry" : ""}`}
                onClick={(e) => open({ action: a }, e)}
              >
                <span className="emo">{a.emoji}</span>
                {a.label}
              </button>
            ))}
            {si === 0 && (
              <button className="tile big custom" onClick={(e) => open({ custom: true }, e)}>
                <span className="emo">✍️</span>
                своя просьба
              </button>
            )}
          </div>
        </section>
      ))}

      {sheet && (
        <>
          <div className="backdrop" onClick={() => !busy && setSheet(null)} />
          <div className="sheet" role="dialog" aria-modal>
            <div className="grabber" />
            {action ? (
              <>
                <div className="head">
                  <div className="emo">{action.emoji}</div>
                  <h2>{action.label}</h2>
                  {action.options && <p className="muted">{action.options.title}</p>}
                </div>
                {action.options && (
                  <div className="options">
                    {action.options.items.map((o) => (
                      <button
                        key={o.id}
                        className="opt"
                        aria-pressed={option === o.id}
                        onClick={() => {
                          haptic.select();
                          setOption(o.id);
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{o.emoji}</span>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {action.location && (
                  <div className="card row spread" style={{ marginBottom: 14 }}>
                    <span style={{ fontWeight: 800 }}>📍 Отправить геолокацию</span>
                    <button
                      className="toggle"
                      role="switch"
                      aria-checked={withLocation}
                      onClick={() => setWithLocation((v) => !v)}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="head">
                  <div className="emo">{emoji}</div>
                  <h2>Своя просьба</h2>
                </div>
                <div className="emoji-pick">
                  {CUSTOM_EMOJIS.map((e) => (
                    <button key={e} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
                <textarea
                  className="field"
                  placeholder="Чего хочется?"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                  style={{ marginBottom: 14 }}
                />
              </>
            )}
            <button className="btn block" disabled={busy || needsOption || (!action && !text.trim())} onClick={send}>
              {busy ? "Отправляю…" : needsOption ? "Выбери вариант 👆" : "Отправить 💌"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function innerWidthSafe() {
  return typeof window === "undefined" ? 360 : window.innerWidth;
}

export function MeTab({ data, run }: { data: AppData; run: Run }) {
  const [mood, setMood] = useState(data.state.mood ?? 6);
  const committed = useRef(data.state.mood);
  useEffect(() => {
    if (data.state.mood) {
      setMood(data.state.mood);
      committed.current = data.state.mood;
    }
  }, [data.state.mood]);

  const commit = () => {
    if (committed.current === mood) return;
    committed.current = mood;
    run("mood", { mood }, "Он увидит твоё настроение");
  };

  const guilts = data.requests.filter((r) => r.kind === "guilty" && r.status !== "done");

  return (
    <div className="stack">
      <div className="card">
        <h3>Настроение сегодня</h3>
        <div className="mood-face" style={{ transform: `scale(${0.9 + mood * 0.02})` }}>
          {MOODS[mood - 1]}
        </div>
        <div className="mood-num">{mood}/10</div>
        <input
          type="range"
          min={1}
          max={10}
          value={mood}
          aria-label="Настроение"
          onChange={(e) => {
            haptic.select();
            setMood(Number(e.target.value));
          }}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
        />
      </div>

      {(Object.keys(MODES) as ModeId[]).map((id) => {
        const m = MODES[id];
        const on = Boolean(data.state.modes[id]);
        return (
          <div key={id} className="card row spread">
            <div className="row">
              <span style={{ fontSize: 32 }}>{m.emoji}</span>
              <div>
                <h3>{m.label}</h3>
                <div className="muted">{m.hint}</div>
              </div>
            </div>
            <button
              className="toggle"
              role="switch"
              aria-checked={on}
              aria-label={m.label}
              onClick={() => {
                haptic.tap();
                run("mode", { mode: id, on: !on }, on ? "Режим выключен" : `${m.emoji} Режим включён`);
              }}
            />
          </div>
        );
      })}

      <div className="card">
        <h3>😡 Счётчик провинностей: {guilts.length}</h3>
        <div className="muted">
          {guilts.length ? "Он ещё не искупил вину за:" : "Сейчас он чист. Подозрительно."}
        </div>
        {guilts.map((g) => (
          <div key={g.id} className="muted" style={{ marginTop: 6 }}>
            • {g.option ?? "просто виноват"}
          </div>
        ))}
      </div>
    </div>
  );
}

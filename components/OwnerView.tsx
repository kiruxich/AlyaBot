"use client";

import { MODES, MOODS, type ModeId } from "@/lib/catalog";
import type { AppData } from "@/lib/types";
import { Empty, RequestCard, timeAgo, type Run } from "./shared";

export function StatusTab({ data, run }: { data: AppData; run: Run }) {
  const { state, requests } = data;
  const modes = (Object.keys(state.modes) as ModeId[]).filter((m) => state.modes[m]);
  const open = requests.filter((r) => r.status === "pending" || r.status === "accepted");
  const guilts = open.filter((r) => r.kind === "guilty");
  const rest = open.filter((r) => r.kind !== "guilty");

  return (
    <div className="stack">
      <div className="card row">
        <span style={{ fontSize: 52 }}>{state.mood ? MOODS[state.mood - 1] : "❔"}</span>
        <div>
          <h3>Настроение: {state.mood ? `${state.mood}/10` : "не указано"}</h3>
          {state.moodAt && <div className="muted">обновлено {timeAgo(state.moodAt)}</div>}
        </div>
      </div>

      {modes.map((m) => (
        <div key={m} className="card row">
          <span style={{ fontSize: 32 }}>{MODES[m].emoji}</span>
          <div>
            <h3>Режим «{MODES[m].label}»</h3>
            <div className="muted">
              {MODES[m].hint} · с {timeAgo(state.modes[m]!)}
            </div>
          </div>
        </div>
      ))}

      <div className="section-title">😡 Провинности ({guilts.length})</div>
      {guilts.length ? (
        guilts.map((r) => <RequestCard key={r.id} r={r} run={run} owner />)
      ) : (
        <Empty emoji="😇" text="Ты чист. Пока что." />
      )}

      <div className="section-title">⏳ Ждут ответа ({rest.length})</div>
      {rest.length ? rest.map((r) => <RequestCard key={r.id} r={r} run={run} owner />) : <Empty emoji="🫡" text="Всё выполнено" />}
    </div>
  );
}

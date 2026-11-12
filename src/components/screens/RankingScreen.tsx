"use client";

import { useState } from "react";
import { PROFESSIONS } from "@/game/config";
import type { RankingRow } from "@/server/game";
import { Avatar } from "../Avatar";
import type { ScreenProps } from "./types";

export function RankingScreen({ state }: ScreenProps) {
  const [which, setWhich] = useState<"week" | "lastWeek" | "allTime">("week");
  const rows: RankingRow[] = state.ranking[which];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section className="panel">
      <h2>Ranking de contribuição</h2>
      <div className="seg">
        {([["week", "Semana"], ["lastWeek", "Anterior"], ["allTime", "Geral"]] as const).map(([k, label]) => (
          <button key={k} className="btn small" aria-pressed={which === k} onClick={() => setWhich(k)}>{label}</button>
        ))}
      </div>
      <table className="rank">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.playerId} className={r.playerId === state.me.id ? "me" : ""}>
              <td className="pos">{r.points > 0 && i < 3 ? medals[i] : `${i + 1}º`}</td>
              <td>
                <span className="row">
                  <Avatar avatar={r.avatar} />
                  <span>{r.name}<br /><span className="small muted">{PROFESSIONS[r.profession].name}</span></span>
                </span>
              </td>
              <td className="pts">{r.points.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 8 }}>
        Pontos vêm de doações ao sítio. A semana vira toda segunda às 00:00 (Brasília).
      </p>
    </section>
  );
}

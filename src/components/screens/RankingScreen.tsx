"use client";

import { useState } from "react";
import { PROFESSIONS } from "@/game/config";
import type { RankingRow } from "@/server/game";
import { Walker } from "@/art/WalkerSprite";
import { Avatar } from "../Avatar";
import { Pane, Split, SplitMain } from "./Split";
import type { ScreenProps } from "./types";

type Period = "week" | "lastWeek" | "allTime";
const PERIODS: [Period, string][] = [["week", "Semana"], ["lastWeek", "Anterior"], ["allTime", "Geral"]];
const PERIOD_TITLE: Record<Period, string> = { week: "Esta semana", lastWeek: "Semana passada", allTime: "Desde o começo" };

/** The top three on steps (2nd, 1st, 3rd), full body. Only those who scored. */
function Podium({ rows }: { rows: RankingRow[] }) {
  const top = rows.filter((r) => r.points > 0).slice(0, 3);
  if (top.length === 0) return <p className="muted small">Ninguém doou ainda. Seja o primeiro!</p>;
  const order = [top[1], top[0], top[2]];
  return (
    <div className="podium">
      {order.map((r, i) => {
        if (!r) return <div key={i} />;
        const place = rows.indexOf(r) + 1;
        return (
          <div key={r.playerId} className={`podium-spot place-${place}`}>
            <Walker avatar={r.avatar} direction="down" walking={false} scale={3} title={r.name} />
            <b className="podium-name">{r.name}</b>
            <span className="small">{r.points.toLocaleString("pt-BR")} pts</span>
            <div className="podium-step">{place}º</div>
          </div>
        );
      })}
    </div>
  );
}

export function RankingScreen({ state }: ScreenProps) {
  const [which, setWhich] = useState<Period>("week");
  const rows: RankingRow[] = state.ranking[which];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Split tabs={[]} active="list" onPick={() => {}}>
      <SplitMain>
        <section className="panel">
          <h2>Pódio · {PERIOD_TITLE[which]}</h2>
          <Podium rows={rows} />
        </section>
      </SplitMain>
      <Pane name="list">
        <section className="panel">
          <h2>Ranking de contribuição</h2>
          <div className="seg">
            {PERIODS.map(([k, label]) => (
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
      </Pane>
    </Split>
  );
}

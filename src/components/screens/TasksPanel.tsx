"use client";

import { claimTasksAction } from "@/app/actions";
import { Coins } from "./MarketScreen";
import type { ScreenProps } from "./types";

/** Today's three tasks (design §17), with one button to claim what is finished. */
export function TasksPanel({ state, act, pending }: ScreenProps) {
  const { tasks } = state;
  const done = tasks.items.filter((t) => t.done).length;
  return (
    <section className="panel stack">
      <div className="row between">
        <h2>Tarefas do dia</h2>
        <span className="small muted">{done} de {tasks.items.length} feitas</span>
      </div>
      {tasks.items.map((t) => (
        <div key={t.kind} className={`task ${t.claimed ? "claimed" : t.done ? "done" : ""}`}>
          <div className="row between">
            <span><span className="task-mark" aria-hidden>{t.claimed ? "✔" : t.done ? "★" : "•"}</span> {t.text}</span>
            <span className="small row" style={{ gap: 6 }}><Coins n={t.coins} /> +{t.xp} XP</span>
          </div>
          <div className={`bar ${t.done ? "full" : ""}`}><i style={{ width: `${(t.progress / t.target) * 100}%` }} /></div>
          <span className="small muted">
            {t.claimed ? "Recebida" : t.done ? "Pronta para receber" : `${t.progress.toLocaleString("pt-BR")} de ${t.target.toLocaleString("pt-BR")}`}
          </span>
        </div>
      ))}
      <p className="small muted row" style={{ gap: 6 }}>
        {tasks.bonusClaimed ? "Bônus do dia recebido. Amanhã tem tarefas novas." : <>Faça as três e ganhe mais <Coins n={tasks.bonusCoins} /></>}
      </p>
      {tasks.claimable && (
        <button className="btn big" disabled={pending} onClick={() => act(claimTasksAction)}>Receber recompensas</button>
      )}
    </section>
  );
}

"use client";

import { PROFESSIONS, RECIPES, RECIPE_KEYS, RESOURCES } from "@/game/config";
import { computeProduction, hasEnough, maxCraftable, ratePerHour, storageHours } from "@/game/rules";
import { collectAction, craftAction, upgradeAction } from "@/app/actions";
import { Res, ResIcon, ResList } from "../Res";
import { useState } from "react";
import { TasksPanel } from "./TasksPanel";
import { Pane, Split, SplitMain } from "./Split";
import type { ScreenProps } from "./types";

export function WorkScreen(props: ScreenProps) {
  const { state, now, act, pending } = props;
  const { me, farm, inventory } = state;
  const prof = PROFESSIONS[me.profession];
  const prod = computeProduction({
    profession: me.profession,
    workshopLevel: me.workshopLevel,
    farmLevel: farm.level,
    lastCollectedAt: new Date(me.lastCollectedAt),
    now,
  });
  const cap = storageHours(farm.level);
  const rate = ratePerHour(me.profession, me.workshopLevel, farm.level);
  const capUnits = Math.floor(rate * cap);
  const elapsedH = (now.getTime() - new Date(me.lastCollectedAt).getTime()) / 3_600_000;
  const pct = Math.min(1, elapsedH / cap);
  const recipes = RECIPE_KEYS.filter((k) => RECIPES[k].profession === me.profession);

  const [pane, setPane] = useState("tasks");
  const tabs = [
    { key: "tasks", label: state.tasks.claimable ? "Tarefas •" : "Tarefas" },
    { key: "recipes", label: "Receitas" },
    { key: "upgrade", label: "Melhorar" },
  ];

  return (
    <Split tabs={tabs} active={pane} onPick={setPane}>
      <Pane name="tasks"><TasksPanel {...props} /></Pane>
      <SplitMain>
      <section className="panel stack">
        <div className="row between">
          <div>
            <h2>{prof.name}</h2>
            <p className="small muted">{prof.workshop.name} nível {me.workshopLevel}</p>
          </div>
          <span className="small">{rate.toLocaleString("pt-BR")} / hora</span>
        </div>
        <div className="row">
          <ResIcon r={prof.produces} scale={4} />
          <div className="grow">
            <span className="big-number">{prod.units}</span>
            <span className="muted"> / {capUnits} {RESOURCES[prof.produces].name}</span>
            <div className={`bar ${pct >= 1 ? "full" : ""}`}><i style={{ width: `${pct * 100}%` }} /></div>
            <p className="small muted">{pct >= 1 ? "Armazém cheio! Colete para não perder." : `Armazém enche em ${cap} h`}</p>
          </div>
        </div>
        <button className="btn big green" disabled={pending || prod.units < 1} onClick={() => act(collectAction)}>
          Coletar
        </button>
      </section>
      </SplitMain>

      <Pane name="recipes">
      <section className="panel stack">
        <h2>Receitas</h2>
        {recipes.map((k) => {
          const rec = RECIPES[k];
          const max = maxCraftable(k, inventory);
          return (
            <div key={k} className="stack" style={{ borderBottom: "2px dashed var(--paper-dark)", paddingBottom: 10 }}>
              <div className="row between wrap">
                <ResList bag={rec.inputs} have={inventory} />
                <span>→ <Res r={rec.output} qty={1} name /></span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {[1, 5].map((n) => (
                  <button key={n} className="btn small secondary" disabled={pending || max < n}
                    onClick={() => act(() => craftAction(k, n))}>×{n}</button>
                ))}
                <button className="btn small" disabled={pending || max < 1}
                  onClick={() => act(() => craftAction(k, max))}>Máx ({max})</button>
              </div>
            </div>
          );
        })}
      </section>
      </Pane>

      <Pane name="upgrade">
      <section className="panel stack">
        <h2>Melhorar {prof.workshop.name}</h2>
        {me.upgradeCost ? (
          <>
            <p className="small muted">
              Nível {me.workshopLevel} → {me.workshopLevel + 1}: produção +25% da base.
              Peça aos amigos o que faltar!
            </p>
            <ResList bag={me.upgradeCost} have={inventory} />
            <button className="btn big" disabled={pending || !hasEnough(inventory, me.upgradeCost)}
              onClick={() => act(upgradeAction)}>Melhorar</button>
          </>
        ) : (
          <p>Nível máximo!</p>
        )}
      </section>
      </Pane>
    </Split>
  );
}

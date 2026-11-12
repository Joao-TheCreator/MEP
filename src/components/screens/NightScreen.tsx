"use client";

import { useState } from "react";
import type { AvatarKey } from "@/art/avatars";
import { NightGame } from "@/prototype/night/NightGame";
import { devNightAction, finishPatrolAction, startPatrolAction, type StartPatrolResult } from "@/app/actions";
import { NIGHT_ROLES, NIGHT_ROLE_KEYS, type NightRoleKey } from "@/game/config";
import type { ScreenProps } from "./types";

/** What the team loses when nobody plays a role tonight. */
const MISSING_TEXT: Record<NightRoleKey, string> = {
  shooter: "Sem atirador: a defesa fica mais fraca.",
  tank: "Sem tanque: a fogueira apanha cheio.",
  support: "Sem suporte: ninguém ganha o bônus de força.",
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

function untilText(target: Date, now: Date) {
  const min = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

/**
 * The night tab (design §15): the campfire, tonight's horde against the
 * farm's defense, the patrol and the seasons that ended in a wipe.
 */
export function NightScreen({ state, now, act, pending }: ScreenProps) {
  const { night, me } = state;
  const [run, setRun] = useState<NonNullable<StartPatrolResult["run"]> | null>(null);
  const [starting, setStarting] = useState(false);
  const holds = night.defense >= night.horde;
  // not enough energy for today's patrol (training after it is free)
  const tired = me.energy.now < me.energy.patrolCost;
  const next = new Date(night.nextAt);
  const firePct = Math.round((night.fireHp / night.fireMax) * 100);

  // the server spends the energy and draws the seed; then the mini-game plays it
  const begin = async () => {
    setStarting(true);
    const r = await startPatrolAction();
    setStarting(false);
    if (r.ok && r.run) setRun(r.run);
    else act(async () => r);
  };

  if (run) {
    return (
      <div className="night">
        <NightGame
          key={run.runId}
          fixedAvatar={me.avatar as AvatarKey}
          fixedClass={run.cls}
          seed={run.seed}
          onFinish={(_won, ticks) => act(() => finishPatrolAction(run.runId, ticks))}
          onClose={() => setRun(null)}
        />
      </div>
    );
  }

  const canExplore = me.patrolledTonight && night.expeditionsLeft > 0;
  const label = starting
    ? "Preparando…"
    : !me.patrolledTonight
      ? tired ? "Sem energia para a ronda" : "Fazer a ronda"
      : night.expeditionsLeft === 0
        ? "Expedições de hoje feitas"
        : tired ? "Sem energia para a expedição" : `Sair em expedição (${night.expeditionsLeft} hoje)`;

  return (
    <>
      <section className="panel stack">
        <div className="row between">
          <h2>Fogueira</h2>
          <span className="small muted">Temporada {night.season}</span>
        </div>
        <div className={`bar fire ${firePct < 35 ? "low" : ""}`}><i style={{ width: `${firePct}%` }} /></div>
        <p className="small">{fmt(night.fireHp)} / {fmt(night.fireMax)} de vida</p>
        <p>
          <b>Noite {night.night}</b> começa às 20h (em {untilText(next, now)}).
        </p>
        <div className="night-versus">
          <div><span className="small muted">Horda de hoje</span><b>{fmt(night.horde)}</b></div>
          <span className="vs">×</span>
          <div><span className="small muted">Defesa agora</span><b className={holds ? "ok" : "bad"}>{fmt(night.defense)}</b></div>
        </div>
        <p className="small">
          {holds
            ? "Do jeito que está, a defesa segura a horda de hoje."
            : `Do jeito que está, a fogueira perde ${fmt(Math.round((night.horde - night.defense) * (1 - night.team.damageCutPct / 100)))} de vida hoje.`}
          {" "}
          {night.lasts === null ? "A fogueira aguenta as próximas noites." : `No ritmo atual, ela apaga em ${night.lasts} ${night.lasts === 1 ? "noite" : "noites"}.`}
        </p>
        <p className="small muted">
          {night.patrolled} de {night.active} moradores ativos já fizeram a ronda. Quem faz a ronda defende com ×1,5; quem dorme, com ×0,5.
        </p>
      </section>

      <section className="panel stack">
        <div className="row between">
          <h2>Time de hoje</h2>
          <span className="small muted">conta quem fez a ronda</span>
        </div>
        <div className="team">
          {NIGHT_ROLE_KEYS.map((k) => (
            <div key={k} className={`team-role ${night.team.counts[k] === 0 ? "empty" : ""} ${night.myRole === k ? "mine" : ""}`}>
              <b>{night.team.counts[k]}</b>
              <span>{NIGHT_ROLES[k].name}</span>
              <span className="small muted">
                {k === "shooter" ? "força ×1,3" : k === "tank" ? `corta ${fmt(night.team.damageCutPct)}% do dano` : `+${fmt(night.team.supportBoostPct)}% de força`}
              </span>
            </div>
          ))}
        </div>
        {night.team.missing.map((k) => <p key={k} className="small team-missing">{MISSING_TEXT[k]}</p>)}
        <p className="small muted">
          Você é {NIGHT_ROLES[night.myRole].name}. Tanques cortam até 40% do dano e suportes dão até +30% de força: com 1 em
          cada 5 moradores em cada papel já chega no máximo. Troque de classe na aba Herói antes da ronda.
        </p>
      </section>

      <section className="panel stack">
        <h2>Sua ronda</h2>
        <p className="small">
          Sua força hoje: <b>{fmt(me.character.power.patrol)}</b> fazendo a ronda, {fmt(me.character.power.rest)} dormindo.
        </p>
        {me.patrolledTonight ? (
          <p className="ok-text">Você já fez a ronda de hoje. Defende a noite {night.night} com força total.</p>
        ) : (
          <p className="small muted">
            Jogue a ronda antes das 20h para entrar na defesa com força total. Custa {me.energy.patrolCost} de energia
            (você tem {me.energy.now} de {me.energy.max}; volta 10 por hora).
          </p>
        )}
<button className="btn big" disabled={pending || starting || tired || (me.patrolledTonight && !canExplore)} onClick={begin}>
          {label}
        </button>
        <p className="small muted">
          As estrelas da ronda dão moedas e materiais achados na mata. Depois da ronda do dia, você ainda pode sair em até
          3 expedições, só pelo que achar. Cada saída custa {me.energy.patrolCost} de energia.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <button className="btn small secondary" disabled={pending} onClick={() => act(devNightAction)}>
            Teste: fazer a noite acontecer agora
          </button>
        )}
      </section>

      {night.last && (
        <section className="panel stack">
          <h2>Última noite</h2>
          <p>
            Noite {night.last.night} (temporada {night.last.season}): horda {fmt(night.last.horde)} × defesa {fmt(night.last.defense)}.{" "}
            {night.last.wiped
              ? "A fogueira apagou. O sítio recomeçou do zero; os itens ficaram."
              : night.last.damage > 0
                ? `A fogueira perdeu ${fmt(night.last.damage)} de vida${night.last.damageCutPct ? ` (os tanques seguraram ${fmt(night.last.damageCutPct)}%)` : ""}.`
                : "A defesa segurou tudo!"}
          </p>
        </section>
      )}

      {night.seasons.length > 0 && (
        <section className="panel">
          <h2>Temporadas</h2>
          {night.seasons.map((s) => (
            <div key={s.season} className="row between" style={{ padding: "4px 0" }}>
              <span>{s.season}ª temporada</span>
              <span className="small muted">caiu na noite {s.endedNight} · {new Date(s.endedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

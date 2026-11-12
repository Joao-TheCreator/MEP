"use client";

import { useState } from "react";
import type { AvatarKey } from "@/art/avatars";
import { NightGame } from "@/prototype/night/NightGame";
import { devNightAction, patrolAction } from "@/app/actions";
import type { ScreenProps } from "./types";

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
  const [playing, setPlaying] = useState(false);
  const holds = night.defense >= night.horde;
  const next = new Date(night.nextAt);
  const firePct = Math.round((night.fireHp / night.fireMax) * 100);

  if (playing) {
    return (
      <div className="night">
        <NightGame
          fixedAvatar={me.avatar as AvatarKey}
          fixedClass={me.character.nightClass === "mattress" ? "colchonete" : "volei"}
          onFinish={() => { if (!me.patrolledTonight) act(patrolAction); }}
          onClose={() => setPlaying(false)}
        />
      </div>
    );
  }

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
            : `Do jeito que está, a fogueira perde ${fmt(night.horde - night.defense)} de vida hoje.`}
          {" "}
          {night.lasts === null ? "A fogueira aguenta as próximas noites." : `No ritmo atual, ela apaga em ${night.lasts} ${night.lasts === 1 ? "noite" : "noites"}.`}
        </p>
        <p className="small muted">
          {night.patrolled} de {night.active} moradores ativos já fizeram a ronda. Quem faz a ronda defende com ×1,5; quem dorme, com ×0,5.
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
          <p className="small muted">Jogue a ronda antes das 20h para entrar na defesa com força total.</p>
        )}
        <button className="btn big" disabled={pending} onClick={() => setPlaying(true)}>
          {me.patrolledTonight ? "Jogar de novo (treino)" : "Fazer a ronda"}
        </button>
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
                ? `A fogueira perdeu ${fmt(night.last.damage)} de vida.`
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

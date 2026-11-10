"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { SpriteRects, type SpriteDef } from "@/art/pixel";
import { rng } from "@/art/grid";
import { TREE_DARK } from "@/art/sprites";
import { WALKERS, WALKER_H } from "@/art/walker";
import { AVATARS, AVATAR_KEYS, type AvatarKey } from "@/art/avatars";
import { Walker } from "@/art/Walker";
import {
  ARENA, CAMP, CLASSES, ENEMIES, WAVES, advance, createNight, fireSpecial, heroDown, nightResult, shieldOn,
  specialReady, type Enemy, type HeroClass, type NightState,
} from "./sim";
import { ASSOMBRACAO, CAMPFIRE, MATTRESS, ORB, SOMBRA, SPIKE_BALL, TENT, VOLLEYBALL, VULTO } from "./sprites";

const PX = 0.5; // world units per sprite pixel
const TICK_MS = 50;
const WALK_CYCLE = [1, 0, 2, 0];
const ENEMY_SPRITES: Record<Enemy["kind"], SpriteDef> = { sombra: SOMBRA, vulto: VULTO, assombracao: ASSOMBRACAO };

/** Sprite drawn at half scale with its feet at (x, y). */
function Feet({ sprite, x, y, flip = false, opacity }: { sprite: SpriteDef; x: number; y: number; flip?: boolean; opacity?: number }) {
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const h = sprite.rows.length;
  const left = Math.round((x - (w * PX) / 2) / PX) * PX;
  const top = Math.round((y - h * PX) / PX) * PX;
  const t = flip
    ? `translate(${left + w * PX} ${top}) scale(${-PX} ${PX})`
    : `translate(${left} ${top}) scale(${PX})`;
  return (
    <g transform={t} opacity={opacity}>
      <SpriteRects sprite={sprite} />
    </g>
  );
}

function Bar({ x, y, w, ratio, color }: { x: number; y: number; w: number; ratio: number; color: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={1} fill="#00000080" />
      <rect x={x - w / 2} y={y} width={Math.max(0, w * ratio)} height={1} fill={color} />
    </g>
  );
}

/** Ground, trees, tents: drawn once. */
const Backdrop = memo(function Backdrop() {
  const r = rng(11);
  const tufts = Array.from({ length: 90 }, () => ({
    x: Math.floor(r() * ARENA.w),
    y: 14 + Math.floor(r() * (ARENA.h - 14)),
    w: 1 + Math.floor(r() * 2),
    c: r() < 0.5 ? "#5f8a3d" : "#4a7333",
  }));
  return (
    <>
      <rect width={ARENA.w} height={ARENA.h} fill="#567f39" />
      {tufts.map((t, i) => <rect key={i} x={t.x} y={t.y} width={t.w} height={1} fill={t.c} />)}
      <path d={`M${CAMP.x} ${CAMP.y} Q ${CAMP.x - 14} ${ARENA.h / 2} ${CAMP.x + 6} 0`} stroke="#8a7350" strokeWidth={6} fill="none" opacity={0.45} />
      {Array.from({ length: 9 }, (_, i) => (
        <SpriteRects key={`t${i}`} sprite={TREE_DARK} x={i * 11 - 4 + (i % 2) * 2} y={-8 + (i % 3) * 2} />
      ))}
      {[16, 40, 64, 88].map((y, i) => (
        <g key={`s${y}`}>
          <SpriteRects sprite={TREE_DARK} x={-7 + (i % 2) * 2} y={y} />
          <SpriteRects sprite={TREE_DARK} x={ARENA.w - 6 - (i % 2) * 2} y={y + 10} />
        </g>
      ))}
      <SpriteRects sprite={TENT} x={CAMP.x - 30} y={CAMP.y - 6} />
      <SpriteRects sprite={TENT} x={CAMP.x + 14} y={CAMP.y - 2} />
    </>
  );
});

function Arena({ s, avatar }: { s: NightState; avatar: AvatarKey }) {
  const h = s.hero;
  const down = heroDown(s);
  const frames = WALKERS[avatar];
  const step = WALK_CYCLE[Math.floor(s.t / 0.16) % WALK_CYCLE.length];
  const sprite = frames[h.facing > 0 ? "right" : "left"][h.moving ? step : 0];
  const swing = s.t - h.attackAt < 0.15;
  const fire = CAMPFIRE[Math.floor(s.t / 0.2) % 2];

  type L = { y: number; key: string; node: React.ReactNode };
  const layers: L[] = s.enemies.map((e) => ({
    y: e.y,
    key: `e${e.id}`,
    node: (
      <g key={`e${e.id}`}>
        <ellipse cx={e.x} cy={e.y} rx={3} ry={0.8} fill="#00000040" />
        <Feet
          sprite={ENEMY_SPRITES[e.kind]}
          x={e.x}
          y={e.kind === "assombracao" ? e.y - 2 + Math.sin(s.t * 4 + e.id) : e.y}
          flip={e.facing > 0}
          opacity={s.t - e.hitAt < 0.1 ? 0.5 : 1}
        />
        {e.hp < e.maxHp && <Bar x={e.x} y={e.y - 10} w={7} ratio={e.hp / e.maxHp} color="#c9a8ff" />}
      </g>
    ),
  }));

  const mattressX = h.x + h.facing * (shieldOn(s) ? 5 : swing ? 5 : 3);
  layers.push({
    y: h.y,
    key: "hero",
    node: (
      <g key="hero" opacity={down ? 0.45 : 1}>
        {shieldOn(s) && <circle cx={h.x} cy={h.y - 6} r={9} fill="#6f9ee6" opacity={0.18 + 0.06 * Math.sin(s.t * 10)} />}
        <ellipse cx={h.x} cy={h.y} rx={4} ry={1} fill="#00000040" />
        <Feet sprite={sprite} x={h.x} y={h.y} />
        {h.cls === "colchonete" && !down && <Feet sprite={MATTRESS} x={mattressX} y={h.y - 1} />}
        {h.cls === "volei" && !down && !swing && <Feet sprite={VOLLEYBALL} x={h.x + h.facing * 4} y={h.y - 4} />}
        {down && <text x={h.x + 3} y={h.y - 14} fontSize={4} fill="#e9d6ff">zzz</text>}
        <Bar x={h.x} y={h.y - WALKER_H * PX - 2} w={9} ratio={h.hp / h.maxHp} color="#8fe07a" />
      </g>
    ),
  });
  layers.sort((a, b) => a.y - b.y);

  return (
    <svg viewBox={`0 0 ${ARENA.w} ${ARENA.h}`} shapeRendering="crispEdges" role="img" aria-label="Ronda da noite">
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#ffb35c" stopOpacity={0.55} />
          <stop offset="1" stopColor="#ffb35c" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="dark" cx="0.2" cy="0.6" r="0.9">
          <stop offset="0.15" stopColor="#0b1030" stopOpacity={0.35} />
          <stop offset="1" stopColor="#060818" stopOpacity={0.78} />
        </radialGradient>
      </defs>
      <Backdrop />
      <rect width={ARENA.w} height={ARENA.h} fill="url(#dark)" />
      <circle cx={CAMP.x} cy={CAMP.y - 4} r={26 + Math.sin(s.t * 6) * 1.2} fill="url(#glow)" style={{ mixBlendMode: "screen" }} />
      <Feet sprite={fire} x={CAMP.x} y={CAMP.y + 2} />
      <Bar x={CAMP.x} y={CAMP.y + 4} w={14} ratio={s.camp.hp / s.camp.max} color="#ffb35c" />
      {layers.map((l) => l.node)}
      {s.shots.map((sh) => (
        <Feet key={sh.id} sprite={sh.kind === "orb" ? ORB : sh.kind === "spike" ? SPIKE_BALL : VOLLEYBALL} x={sh.x} y={sh.y + 1.5} />
      ))}
      {s.fx.map((f) => (
        <text
          key={f.id}
          x={f.x}
          y={f.y - (s.t - f.at) * 8}
          fontSize={4}
          textAnchor="middle"
          fill={f.color}
          opacity={1 - (s.t - f.at) / 0.9}
          style={{ fontFamily: "var(--font-display), monospace" }}
        >
          {f.text}
        </text>
      ))}
    </svg>
  );
}

export function NightGame() {
  const [screen, setScreen] = useState<"pick" | "play">("pick");
  const [cls, setCls] = useState<HeroClass>("volei");
  const [avatar, setAvatar] = useState<AvatarKey>("joao-pedro");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const night = useRef<NightState | null>(null);
  const [, setFrame] = useState(0);

  const s = night.current;
  const over = !!s && (s.phase === "won" || s.phase === "lost");

  const start = () => {
    night.current = createNight(cls, Math.floor(Math.random() * 1e6));
    setPaused(false);
    setScreen("play");
    setFrame((f) => f + 1);
  };

  useEffect(() => {
    if (screen !== "play" || paused || over) return;
    const id = setInterval(() => {
      if (night.current) advance(night.current, (TICK_MS / 1000) * speed);
      setFrame((f) => f + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [screen, paused, speed, over]);

  const special = useCallback(() => {
    if (night.current && fireSpecial(night.current)) setFrame((f) => f + 1);
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); special(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, special]);

  if (screen === "pick" || !s) {
    return (
      <>
        <section className="panel stack">
          <h2>Escolha a classe</h2>
          <div className="night-classes">
            {(Object.keys(CLASSES) as HeroClass[]).map((k) => {
              const c = CLASSES[k];
              return (
                <button key={k} className="night-class" aria-pressed={cls === k} onClick={() => setCls(k)}>
                  <b>{c.name}</b>
                  <span className="small muted">{c.role}</span>
                  <span className="small">Vida {c.hp} · Dano {c.damage}</span>
                  <span className="small"><b>{c.special.name}:</b> {c.special.description}</span>
                </button>
              );
            })}
          </div>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="grow">
              <label htmlFor="who">Quem vai fazer a ronda</label>
              <select id="who" value={avatar} onChange={(e) => setAvatar(e.target.value as AvatarKey)}>
                {AVATAR_KEYS.map((k) => <option key={k} value={k}>{AVATARS[k].name}</option>)}
              </select>
            </div>
            <Walker avatar={avatar} direction="right" scale={3} />
          </div>
          <button className="btn big" onClick={start}>Começar a noite</button>
        </section>
        <section className="panel stack">
          <h2>Como funciona</h2>
          <p className="small">
            Defenda a fogueira do acampamento por {WAVES.length} ondas. Seu boneco ataca sozinho; você só escolhe
            a hora do <b>poder especial</b> (botão grande ou barra de espaço), que carrega acertando os inimigos.
          </p>
          <ul className="small night-enemies">
            <li><b>{ENEMIES.sombra.name}</b>: lenta e resistente, vai direto na fogueira.</li>
            <li><b>{ENEMIES.vulto.name}</b>: rápido e fraco, corre atrás de quem estiver perto.</li>
            <li><b>{ENEMIES.assombracao.name}</b>: flutua de longe e atira bolas de luz.</li>
          </ul>
          <p className="small muted">Protótipo para testar a ideia da issue #14. Nada aqui conta no jogo ainda.</p>
        </section>
      </>
    );
  }

  const h = s.hero;
  const c = CLASSES[h.cls];
  const result = over ? nightResult(s) : null;
  const ready = specialReady(s);
  const status =
    s.phase === "break" ? `Onda ${s.wave + 2} chegando…` :
    s.phase === "fighting" ? `Onda ${s.wave + 1} de ${WAVES.length}` :
    s.phase === "won" ? "Amanheceu!" : "A fogueira apagou";

  return (
    <>
      <section className="panel night-hud">
        <div className="row between">
          <b>{status}</b>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn small secondary" onClick={() => setSpeed((v) => (v === 1 ? 2 : 1))} disabled={over}>{speed}×</button>
            <button className="btn small secondary" onClick={() => setPaused((p) => !p)} disabled={over}>{paused ? "▶" : "❚❚"}</button>
          </span>
        </div>
        <div className="night-bars">
          <span className="small">Fogueira</span>
          <div className="bar"><i style={{ width: `${(s.camp.hp / s.camp.max) * 100}%`, background: "#e5903a" }} /></div>
          <span className="small">{AVATARS[avatar].name}</span>
          <div className="bar"><i style={{ width: `${(h.hp / h.maxHp) * 100}%` }} /></div>
        </div>
      </section>

      <section className="night-arena">
        <Arena s={s} avatar={avatar} />
        {paused && <div className="night-overlay">Pausado</div>}
      </section>

      {result ? (
        <section className="panel stack night-result">
          <h2>{result.won ? "Amanheceu!" : "A fogueira apagou…"}</h2>
          <p className="night-stars" aria-label={`${result.stars} de 3 estrelas`}>
            {[0, 1, 2].map((i) => <span key={i} className={i < result.stars ? "on" : ""}>★</span>)}
          </p>
          <p>{result.mood}</p>
          <p className="small muted">
            {result.tiredPercent > 0 ? `Amanhã: ${AVATARS[avatar].name} produz ${result.tiredPercent}% menos.` : "Amanhã: produção normal."}
            {" "}Inimigos derrotados: {s.kills} · Especiais usados: {s.specials}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn big" onClick={start}>Jogar de novo</button>
            <button className="btn big secondary" onClick={() => setScreen("pick")}>Trocar classe</button>
          </div>
        </section>
      ) : (
        <button
          className={`btn big night-special ${ready ? "ready" : ""}`}
          disabled={!ready || paused}
          onClick={special}
        >
          <span className="night-energy" style={{ width: `${h.energy}%` }} />
          <span className="night-special-label">
            {heroDown(s) ? "Desmaiado…" : ready ? `${c.special.name}!` : `${c.special.name} ${Math.floor(h.energy)}%`}
          </span>
        </button>
      )}
    </>
  );
}


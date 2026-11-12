import { PATROL, RESOURCES, type Bag, type ResourceKey } from "./config";

/**
 * Night patrol ("ronda da noite", design §18): a small deterministic
 * auto-battler. The hero defends the campfire from three waves of night
 * creatures; the player only chooses when to fire the special.
 *
 * The same seed and the same special ticks always give the same night, so the
 * server replays what the phone played (replayPatrol) and computes the stars
 * and the rewards itself. Pure: no I/O, no clock, no Math.random.
 */

/** Small deterministic generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export type HeroClass = "volei" | "colchonete";
export type EnemyKind = "sombra" | "vulto" | "assombracao";

/** Arena in world units (one walker pixel = half a unit, like the farm map). */
/** Portrait arena (phone first): campfire at the bottom, creatures come from the woods above. */
export const ARENA = { w: 96, h: 120, left: 4, right: 92, top: 16, bottom: 116 };
export const CAMP = { x: 48, y: 102, r: 8, hp: 200 };
const GUARD = { x: 48, y: 84 };
/** Seconds of game time per simulation step (fixed, so replays match exactly). */
export const STEP = 0.05;

export const CLASSES = {
  volei: {
    name: "Jogador de vôlei",
    role: "Ataca de longe",
    hp: 65,
    speed: 26,
    range: 44,
    damage: 8,
    cooldown: 0.8,
    energyPerHit: 7,
    special: { name: "Cortada", description: "Três bolas que atravessam todo mundo pelo caminho." },
  },
  colchonete: {
    name: "Colchonete",
    role: "Corpo a corpo, aguenta pancada",
    hp: 130,
    speed: 20,
    range: 9,
    damage: 12,
    cooldown: 0.75,
    energyPerHit: 10,
    special: {
      name: "Colchonetada",
      description: "Pancada em volta que empurra todo mundo e escudo de 4 s que puxa os inimigos para você.",
    },
  },
} as const;

export const ENEMIES = {
  sombra: { name: "Sombra", hp: 30, speed: 9, damage: 4, cooldown: 1, range: 7, aggro: 12, ranged: false },
  vulto: { name: "Vulto", hp: 14, speed: 21, damage: 3, cooldown: 0.7, range: 6, aggro: 22, ranged: false },
  assombracao: { name: "Assombração", hp: 36, speed: 7, damage: 5, cooldown: 1.8, range: 34, aggro: 34, ranged: true },
} as const;

type Wave = { every: number; kinds: EnemyKind[] };
const S: EnemyKind = "sombra";
const V: EnemyKind = "vulto";
const A: EnemyKind = "assombracao";
export const WAVES: Wave[] = [
  { every: 2.4, kinds: [S, S, S, S, S, S] },
  { every: 1.7, kinds: [S, V, V, S, V, S, V, V, S, V] },
  { every: 1.6, kinds: [V, S, A, V, V, S, A, V, S, V, A, S, V] },
];
const BREAK_S = 3;
const DOWN_S = 5;
const SHIELD_S = 4;

export interface Hero {
  cls: HeroClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cd: number;
  energy: number;
  shieldUntil: number;
  downUntil: number;
  facing: 1 | -1;
  moving: boolean;
  /** time of the last attack, for the swing animation */
  attackAt: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cd: number;
  facing: 1 | -1;
  hitAt: number;
}

export interface Shot {
  id: number;
  kind: "ball" | "spike" | "orb";
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: boolean;
  hit: number[];
  ttl: number;
}

export interface Fx {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  at: number;
}

export type Phase = "fighting" | "break" | "won" | "lost";

export interface NightState {
  t: number;
  /** Simulation steps run so far. */
  ticks: number;
  /** Step at which each special was fired (what the server replays). */
  specialTicks: number[];
  phase: Phase;
  wave: number;
  waveStart: number;
  breakUntil: number;
  queue: { at: number; kind: EnemyKind }[];
  hero: Hero;
  enemies: Enemy[];
  shots: Shot[];
  fx: Fx[];
  camp: { hp: number; max: number };
  kills: number;
  specials: number;
  nextId: number;
  rand: () => number;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clampX = (x: number) => Math.min(ARENA.right, Math.max(ARENA.left, x));
const clampY = (y: number) => Math.min(ARENA.bottom, Math.max(ARENA.top, y));

export function createNight(cls: HeroClass, seed = 1): NightState {
  const c = CLASSES[cls];
  const s: NightState = {
    t: 0,
    ticks: 0,
    specialTicks: [],
    phase: "fighting",
    wave: 0,
    waveStart: 0,
    breakUntil: 0,
    queue: [],
    hero: {
      cls, x: GUARD.x, y: GUARD.y, hp: c.hp, maxHp: c.hp, cd: 0, energy: 0,
      shieldUntil: -1, downUntil: -1, facing: 1, moving: false, attackAt: -1,
    },
    enemies: [],
    shots: [],
    fx: [],
    camp: { hp: CAMP.hp, max: CAMP.hp },
    kills: 0,
    specials: 0,
    nextId: 1,
    rand: rng(seed),
  };
  startWave(s, 0);
  return s;
}

function startWave(s: NightState, i: number) {
  s.wave = i;
  s.waveStart = s.t;
  s.phase = "fighting";
  s.queue = WAVES[i].kinds.map((kind, k) => ({ at: 0.5 + k * WAVES[i].every, kind }));
}

function fx(s: NightState, x: number, y: number, text: string, color = "#fff4d6") {
  s.fx.push({ id: s.nextId++, x, y, text, color, at: s.t });
}

export const heroDown = (s: NightState) => s.t < s.hero.downUntil;
export const shieldOn = (s: NightState) => s.t < s.hero.shieldUntil;
export const specialReady = (s: NightState) =>
  s.hero.energy >= 100 && !heroDown(s) && (s.phase === "fighting" || s.phase === "break");

function hurtEnemy(s: NightState, e: Enemy, dmg: number) {
  e.hp -= dmg;
  e.hitAt = s.t;
  fx(s, e.x, e.y - 9, String(dmg));
}

function hurtHero(s: NightState, dmg: number) {
  const h = s.hero;
  if (heroDown(s)) return;
  const real = shieldOn(s) ? Math.max(1, Math.round(dmg * 0.3)) : dmg;
  h.hp -= real;
  fx(s, h.x, h.y - 15, `-${real}`, "#ff8a8a");
  if (h.hp <= 0) {
    h.hp = 0;
    h.downUntil = s.t + DOWN_S;
    fx(s, h.x, h.y - 18, "Desmaiou!", "#ff8a8a");
  }
}

function hurtCamp(s: NightState, dmg: number) {
  s.camp.hp = Math.max(0, s.camp.hp - dmg);
  fx(s, CAMP.x, CAMP.y - 12, `-${dmg}`, "#ffb35c");
}

/** Enemy that threatens the camp the most (closest to it). */
function threat(s: NightState): Enemy | undefined {
  let best: Enemy | undefined;
  let bd = Infinity;
  for (const e of s.enemies) {
    const d = dist(e.x, e.y, CAMP.x, CAMP.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function moveToward(o: { x: number; y: number }, tx: number, ty: number, step: number) {
  const d = dist(o.x, o.y, tx, ty);
  if (d < 0.001) return;
  const k = Math.min(1, step / d);
  o.x = clampX(o.x + (tx - o.x) * k);
  o.y = clampY(o.y + (ty - o.y) * k);
}

function updateHero(s: NightState, dt: number) {
  const h = s.hero;
  const c = CLASSES[h.cls];
  h.moving = false;
  if (heroDown(s)) return;
  if (h.downUntil > 0 && h.hp === 0) {
    h.hp = Math.round(h.maxHp / 2);
    fx(s, h.x, h.y - 18, "Voltou!", "#b6f08a");
  }
  h.cd -= dt;
  const target = threat(s);
  if (!target) {
    if (dist(h.x, h.y, GUARD.x, GUARD.y) > 1) {
      h.facing = GUARD.x >= h.x ? 1 : -1;
      moveToward(h, GUARD.x, GUARD.y, c.speed * dt);
      h.moving = true;
    }
    return;
  }
  const d = dist(h.x, h.y, target.x, target.y);
  h.facing = target.x >= h.x ? 1 : -1;
  if (d > c.range) {
    moveToward(h, target.x, target.y, c.speed * dt);
    h.moving = true;
  } else if (h.cls === "volei" && d < 14) {
    // keep some distance, backing towards the camp
    const back = { x: h.x, y: h.y };
    moveToward(back, h.x - (target.x - h.x), h.y - (target.y - h.y), c.speed * 0.7 * dt);
    if (dist(back.x, back.y, CAMP.x, CAMP.y) > CAMP.r + 4) {
      h.x = back.x;
      h.y = back.y;
      h.moving = true;
    }
  }
  if (d <= c.range && h.cd <= 0) {
    h.cd = c.cooldown;
    h.attackAt = s.t;
    if (h.cls === "volei") {
      const v = 90 / d;
      s.shots.push({
        id: s.nextId++, kind: "ball", x: h.x, y: h.y - 8, vx: (target.x - h.x) * v, vy: (target.y - 4 - (h.y - 8)) * v,
        damage: c.damage, pierce: false, hit: [], ttl: 1,
      });
    } else {
      hurtEnemy(s, target, c.damage);
      h.energy = Math.min(100, h.energy + c.energyPerHit);
      const k = 3 / Math.max(d, 1);
      target.x = clampX(target.x + (target.x - h.x) * k);
      target.y = clampY(target.y + (target.y - h.y) * k);
    }
  }
}

function updateEnemies(s: NightState, dt: number) {
  const h = s.hero;
  const heroUp = !heroDown(s);
  for (const e of s.enemies) {
    const def = ENEMIES[e.kind];
    e.cd -= dt;
    const dh = dist(e.x, e.y, h.x, h.y);
    const onHero = heroUp && (dh < def.aggro || (shieldOn(s) && dh < 45));
    const tx = onHero ? h.x : CAMP.x;
    const ty = onHero ? h.y : CAMP.y;
    const reach = def.range + (onHero ? 0 : CAMP.r);
    const d = dist(e.x, e.y, tx, ty);
    e.facing = tx >= e.x ? 1 : -1;
    if (d > reach) {
      moveToward(e, tx, ty, def.speed * dt);
      continue;
    }
    if (e.cd > 0) continue;
    e.cd = def.cooldown;
    if (def.ranged) {
      const v = 45 / Math.max(d, 1);
      s.shots.push({
        id: s.nextId++, kind: "orb", x: e.x, y: e.y - 5, vx: (tx - e.x) * v, vy: (ty - 6 - (e.y - 5)) * v,
        damage: def.damage, pierce: false, hit: [], ttl: 1.5,
      });
    } else if (onHero) {
      hurtHero(s, def.damage);
    } else {
      hurtCamp(s, def.damage);
    }
  }
  // keep them from stacking on one spot
  for (let i = 0; i < s.enemies.length; i++) {
    for (let j = i + 1; j < s.enemies.length; j++) {
      const a = s.enemies[i];
      const b = s.enemies[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > 0 && d < 6) {
        const push = (6 - d) / 2 / d;
        const dx = (b.x - a.x) * push;
        const dy = (b.y - a.y) * push;
        a.x -= dx; a.y = clampY(a.y - dy);
        b.x += dx; b.y = clampY(b.y + dy);
      }
    }
  }
}

function updateShots(s: NightState, dt: number) {
  const h = s.hero;
  for (const sh of s.shots) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    sh.ttl -= dt;
    if (sh.kind === "orb") {
      if (!heroDown(s) && dist(sh.x, sh.y, h.x, h.y - 6) < 5) {
        hurtHero(s, sh.damage);
        sh.ttl = 0;
      } else if (dist(sh.x, sh.y, CAMP.x, CAMP.y - 3) < CAMP.r) {
        hurtCamp(s, sh.damage);
        sh.ttl = 0;
      }
      continue;
    }
    for (const e of s.enemies) {
      if (e.hp <= 0 || sh.hit.includes(e.id)) continue;
      if (dist(sh.x, sh.y, e.x, e.y - 4) < (sh.kind === "spike" ? 7 : 5)) {
        hurtEnemy(s, e, sh.damage);
        sh.hit.push(e.id);
        if (sh.kind === "ball") h.energy = Math.min(100, h.energy + CLASSES.volei.energyPerHit);
        if (!sh.pierce) { sh.ttl = 0; break; }
      }
    }
  }
  s.shots = s.shots.filter((sh) => sh.ttl > 0 && sh.x > -10 && sh.x < ARENA.w + 10 && sh.y > -10 && sh.y < ARENA.h + 10);
}

/** Most come out of the woods at the top; some sneak in from the sides. */
function spawnPoint(s: NightState) {
  const r = s.rand();
  if (r < 0.7) return { x: 8 + s.rand() * (ARENA.w - 16), y: ARENA.top - 6 };
  return { x: r < 0.85 ? -6 : ARENA.w + 6, y: ARENA.top + s.rand() * 40 };
}

function tick(s: NightState, dt: number) {
  s.t += dt;
  s.ticks += 1;
  if (s.phase === "break") {
    if (s.t >= s.breakUntil) startWave(s, s.wave + 1);
  }
  while (s.phase === "fighting" && s.queue.length && s.queue[0].at <= s.t - s.waveStart) {
    const { kind } = s.queue.shift()!;
    const def = ENEMIES[kind];
    s.enemies.push({
      id: s.nextId++, kind, ...spawnPoint(s),
      hp: def.hp, maxHp: def.hp, cd: def.cooldown, facing: -1, hitAt: -1,
    });
  }
  updateHero(s, dt);
  updateEnemies(s, dt);
  updateShots(s, dt);
  const before = s.enemies.length;
  s.enemies = s.enemies.filter((e) => {
    if (e.hp > 0) return true;
    fx(s, e.x, e.y - 6, "✦", "#e9d6ff");
    return false;
  });
  s.kills += before - s.enemies.length;
  s.fx = s.fx.filter((f) => s.t - f.at < 0.9);
  if (s.camp.hp <= 0) {
    s.phase = "lost";
    return;
  }
  if (s.phase === "fighting" && s.queue.length === 0 && s.enemies.length === 0) {
    if (s.wave === WAVES.length - 1) s.phase = "won";
    else { s.phase = "break"; s.breakUntil = s.t + BREAK_S; }
  }
}

/** Advances the night by `seconds` in fixed steps (same result at any frame rate). */
export function advance(s: NightState, seconds: number) {
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let i = 0; i < steps && s.phase !== "won" && s.phase !== "lost"; i++) tick(s, STEP);
}

export function fireSpecial(s: NightState): boolean {
  if (!specialReady(s)) return false;
  const h = s.hero;
  h.energy = 0;
  h.attackAt = s.t;
  s.specials++;
  s.specialTicks.push(s.ticks);
  if (h.cls === "volei") {
    const t = threat(s);
    const base = t ? Math.atan2(t.y - h.y, t.x - h.x) : 0;
    for (const off of [-0.22, 0, 0.22]) {
      s.shots.push({
        id: s.nextId++, kind: "spike", x: h.x, y: h.y - 8, vx: Math.cos(base + off) * 110, vy: Math.sin(base + off) * 110,
        damage: 18, pierce: true, hit: [], ttl: 1.4,
      });
    }
    fx(s, h.x, h.y - 18, "Cortada!", "#ffe08a");
  } else {
    for (const e of s.enemies) {
      const d = dist(e.x, e.y, h.x, h.y);
      if (d > 24) continue;
      hurtEnemy(s, e, 16);
      const k = 14 / Math.max(d, 1);
      e.x = clampX(e.x + (e.x - h.x) * k);
      e.y = clampY(e.y + (e.y - h.y) * k);
    }
    h.shieldUntil = s.t + SHIELD_S;
    fx(s, h.x, h.y - 18, "Colchonetada!", "#9cc8ff");
  }
  return true;
}

export interface NightResult {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  /** production penalty for the next day, in percent (proposal, issue #14) */
  tiredPercent: number;
  mood: string;
}

export function nightResult(s: NightState): NightResult {
  const won = s.phase === "won";
  const ratio = s.camp.hp / s.camp.max;
  const stars = !won ? 0 : ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1;
  const tiredPercent = [30, 15, 5, 0][stars];
  const mood = [
    "A fogueira apagou. Amanhã todo mundo acorda cansado.",
    "Sobreviveram, mas foi por pouco. Dia seguinte puxado.",
    "Boa noite de ronda. Só um cansacinho de manhã.",
    "Noite tranquila depois da batalha. Todo mundo descansado!",
  ][stars];
  return { won, stars, tiredPercent, mood };
}

// ---------- server replay and rewards (design §18) ----------

/** A night never runs longer than this many steps (10 minutes of game time). */
export const MAX_TICKS = Math.round(600 / STEP);

/** Whether a list of special ticks sent by a phone is well formed. */
export function validSpecialTicks(ticks: unknown): ticks is number[] {
  if (!Array.isArray(ticks) || ticks.length > PATROL.maxSpecials) return false;
  let last = -1;
  for (const t of ticks) {
    if (!Number.isInteger(t) || t <= last || t >= MAX_TICKS) return false;
    last = t;
  }
  return true;
}

/**
 * Plays a whole night again from its seed, firing the special at the given
 * steps. A special asked for when it is not charged is simply ignored, as it
 * would be on the phone.
 */
export function replayPatrol(cls: HeroClass, seed: number, specialTicks: number[]): NightResult {
  const s = createNight(cls, seed);
  let next = 0;
  while (s.phase !== "won" && s.phase !== "lost" && s.ticks < MAX_TICKS) {
    while (next < specialTicks.length && specialTicks[next] <= s.ticks) {
      if (specialTicks[next] === s.ticks) fireSpecial(s);
      next++;
    }
    advance(s, STEP);
  }
  return nightResult(s);
}

export interface PatrolRewards {
  coins: number;
  loot: Bag;
}

/**
 * What a patrol pays: coins per star, and one loot roll per star. Each roll is
 * a material worth about lootPointsBase + lootPointsPerNight × night points,
 * so the patrol is a solo source of what other professions make.
 */
export function patrolRewards(stars: number, night: number, seed: number): PatrolRewards {
  const n = Math.max(1, Math.floor(night));
  if (stars <= 0) return { coins: PATROL.consolationCoins, loot: {} };
  const coins = stars * (PATROL.coinsPerStarBase + PATROL.coinsPerStarPerNight * n);
  const rand = rng((seed ^ 0x9e3779b9) >>> 0);
  const table = Object.entries(PATROL.lootWeights) as [ResourceKey, number][];
  const total = table.reduce((a, [, w]) => a + w, 0);
  const budget = PATROL.lootPointsBase + PATROL.lootPointsPerNight * n;
  const loot: Bag = {};
  for (let i = 0; i < stars; i++) {
    let roll = rand() * total;
    let pick = table[0][0];
    for (const [r, w] of table) {
      roll -= w;
      if (roll < 0) { pick = r; break; }
    }
    loot[pick] = (loot[pick] ?? 0) + Math.max(1, Math.floor(budget / RESOURCES[pick].points));
  }
  return { coins, loot };
}

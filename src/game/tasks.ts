/**
 * Daily tasks and energy (design §17). Pure functions; numbers in DAILY_TASKS and
 * ENERGY (./config). The day's tasks are fixed by a seed (player + day), the
 * level and the profession the player had when the day started.
 */
import { DAILY_TASKS, ENERGY, PROFESSIONS, RESOURCES, type ProfessionKey } from "./config";

export type TaskKind = "collect" | "craft" | "donate" | "patrol" | "sell" | "gear";

/** What the player did today (one counter per kind of task). */
export type DailyCounters = Record<TaskKind, number>;

export function emptyCounters(): DailyCounters {
  return { collect: 0, craft: 0, donate: 0, patrol: 0, sell: 0, gear: 0 };
}

export interface DailyTask {
  kind: TaskKind;
  target: number;
  /** Player-facing text (pt-BR). */
  text: string;
  coins: number;
  xp: number;
}

/** Small deterministic generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed for a player's tasks on a game day (FNV-1a of "player|day"). */
export function taskSeed(playerId: string, day: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${playerId}|${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function targetOf(kind: TaskKind, level: number, profession: ProfessionKey): number {
  const T = DAILY_TASKS;
  switch (kind) {
    case "collect": {
      const raw = PROFESSIONS[profession].baseRatePerHour * T.collectHours * (1 + 0.1 * (level - 1));
      return Math.round(raw / 10) * 10;
    }
    case "craft":
      return Math.min(T.craftMax, T.craftBase + T.craftPerLevel * level);
    case "donate":
      return T.donateBase + T.donatePerLevel * level;
    case "sell":
      return T.sellBase + T.sellPerLevel * level;
    case "patrol":
    case "gear":
      return 1;
  }
}

function textOf(kind: TaskKind, target: number, profession: ProfessionKey): string {
  const n = target.toLocaleString("pt-BR");
  switch (kind) {
    case "collect":
      return `Colete ${n} de ${RESOURCES[PROFESSIONS[profession].produces].name}`;
    case "craft":
      return `Fabrique ${n} itens na oficina`;
    case "donate":
      return `Doe ${n} pontos para a obra`;
    case "sell":
      return `Venda ${n} moedas na Vendinha`;
    case "patrol":
      return "Faça a ronda da noite";
    case "gear":
      return "Melhore ou refine um item";
  }
}

/**
 * The day's tasks: always "collect" (everyone can do it alone), plus two drawn
 * from the others. "donate" is left out when there is nothing being built.
 */
export function dailyTasks(seed: number, level: number, profession: ProfessionKey, canDonate: boolean): DailyTask[] {
  const lv = Math.max(1, Math.floor(level));
  const rand = rng(seed);
  const pool: TaskKind[] = ["craft", "patrol", "sell", "gear"];
  if (canDonate) pool.push("donate");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const kinds: TaskKind[] = ["collect", ...pool.slice(0, DAILY_TASKS.perDay - 1)];
  return kinds.map((kind) => {
    const target = targetOf(kind, lv, profession);
    return {
      kind,
      target,
      text: textOf(kind, target, profession),
      coins: DAILY_TASKS.coinsBase + DAILY_TASKS.coinsPerLevel * lv,
      xp: DAILY_TASKS.xpBase + DAILY_TASKS.xpPerLevel * lv,
    };
  });
}

export function taskDone(task: DailyTask, counters: DailyCounters): boolean {
  return counters[task.kind] >= task.target;
}

/** Extra coins for finishing every task of the day. */
export function allDoneBonus(level: number): number {
  return DAILY_TASKS.bonusCoinsBase + DAILY_TASKS.bonusCoinsPerLevel * Math.max(1, Math.floor(level));
}

export interface TaskClaim {
  /** Bitmask of the tasks claimed after this claim (bit i = task i). */
  claimed: number;
  bonusClaimed: boolean;
  coins: number;
  xp: number;
}

/** Claims every finished task not claimed yet, plus the bonus when all are claimed. */
export function claimTasks(tasks: DailyTask[], counters: DailyCounters, claimed: number, bonusClaimed: boolean, level: number): TaskClaim {
  let mask = claimed;
  let coins = 0;
  let xp = 0;
  tasks.forEach((t, i) => {
    if (mask & (1 << i) || !taskDone(t, counters)) return;
    mask |= 1 << i;
    coins += t.coins;
    xp += t.xp;
  });
  const all = (1 << tasks.length) - 1;
  let bonus = bonusClaimed;
  if (!bonus && mask === all) {
    bonus = true;
    coins += allDoneBonus(level);
  }
  return { claimed: mask, bonusClaimed: bonus, coins, xp };
}

// ---------- energy ----------

/** Energy now: what was stored at `at` plus the regeneration since then (capped). */
export function energyNow(stored: number, at: Date, now: Date, regenPct = 0): number {
  const hours = Math.max(0, now.getTime() - at.getTime()) / 3_600_000;
  const gained = hours * ENERGY.regenPerHour * (1 + regenPct / 100);
  return Math.min(ENERGY.max, Math.floor(stored + gained));
}

/** Minutes until the energy reaches `need` (0 when it is already there). */
export function minutesUntilEnergy(current: number, need: number, regenPct = 0): number {
  if (current >= need) return 0;
  const perMinute = (ENERGY.regenPerHour * (1 + regenPct / 100)) / 60;
  return Math.ceil((need - current) / perMinute);
}

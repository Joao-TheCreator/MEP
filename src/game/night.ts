/**
 * Night hordes and the wipe (design §15). Pure functions only; numbers live in
 * ./config (NIGHT, COMBAT, FIRE, NIGHT_REWARDS).
 */
import { COMBAT, FIRE, NIGHT, NIGHT_REWARDS, type CharacterBonuses } from "./config";

/** Members the horde is scaled to: the active ones, never fewer than the minimum. */
export function hordeMembers(activeMembers: number): number {
  return Math.max(NIGHT.minMembersForHorde, activeMembers);
}

/** Strength of the horde on night `night` (1 = first night of the season). */
export function hordeStrength(night: number, activeMembers: number): number {
  const n = Math.max(1, Math.floor(night));
  return Math.round(NIGHT.baseHordePerMember * hordeMembers(activeMembers) * Math.pow(NIGHT.growthPerNight, n - 1));
}

/**
 * One resident's power at night: level sets the base; the weapon, Força and talents
 * raise damage; the body armour and Resistência raise health (counted with a square
 * root, so armour helps but damage matters more). Playing the patrol multiplies it.
 */
export function residentPower(level: number, bonuses: Pick<CharacterBonuses, "damagePct" | "healthPct">, patrolled: boolean): number {
  const base = COMBAT.basePower + COMBAT.powerPerLevel * (Math.max(1, level) - 1);
  const power = base * (1 + bonuses.damagePct / 100) * Math.sqrt(1 + bonuses.healthPct / 100);
  return power * (patrolled ? COMBAT.patrolMultiplier : COMBAT.restingMultiplier);
}

/** The whole farm's defense: everyone's power plus the farm-level bonus. */
export function farmDefense(residentPowers: number[], farmLevel: number): number {
  const sum = residentPowers.reduce((a, b) => a + b, 0);
  return Math.round(sum * (1 + (COMBAT.farmDefensePctPerLevel * (farmLevel - 1)) / 100));
}

export function fireMaxHp(activeMembers: number, farmLevel: number): number {
  return Math.round(FIRE.hpPerMember * hordeMembers(activeMembers) * (1 + (FIRE.hpPctPerFarmLevel * (farmLevel - 1)) / 100));
}

/** Fire HP after a day of rest (regen), before the night. */
export function fireAfterRest(hp: number, maxHp: number): number {
  return Math.min(maxHp, hp + Math.round((maxHp * FIRE.regenPctPerDay) / 100));
}

export interface NightOutcome {
  horde: number;
  defense: number;
  /** Damage the fire took (0 when the defense held). */
  damage: number;
  fireHp: number;
  /** The fire went out: the farm is wiped. */
  wiped: boolean;
}

/** Resolves one night: whatever the defense does not stop burns the fire. */
export function resolveNight(params: { night: number; activeMembers: number; defense: number; fireHp: number }): NightOutcome {
  const horde = hordeStrength(params.night, params.activeMembers);
  const damage = Math.max(0, horde - params.defense);
  const fireHp = Math.max(0, params.fireHp - damage);
  return { horde, defense: params.defense, damage, fireHp, wiped: fireHp === 0 };
}

/** XP for playing the patrol on a night the farm survived. */
export function patrolXp(night: number): number {
  return NIGHT_REWARDS.xpBase + NIGHT_REWARDS.xpPerNight * Math.max(1, Math.floor(night));
}

/**
 * What a wipe keeps (design §15.4): only the items, with their tier and refine.
 * Everything else goes back to the start of a season.
 */
export const WIPE_KEEPS = ["gear"] as const;
export const WIPE_RESETS = [
  "farm level and buildings",
  "resources",
  "workshop levels",
  "character level, XP, attributes and talents",
  "night counter (the horde starts again at night 1)",
] as const;

/**
 * Moments the horde attacked strictly after `from` and up to `to` (inclusive):
 * every day at NIGHT.hour in Brasília (UTC−3, no daylight saving since 2019).
 */
export function nightTimesBetween(from: Date, to: Date, max = 120): Date[] {
  const out: Date[] = [];
  const utcHour = NIGHT.hour + 3;
  const t = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), utcHour));
  if (t <= from) t.setUTCDate(t.getUTCDate() + 1);
  while (t <= to && out.length < max) {
    out.push(new Date(t));
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

/** Next attack after `now`. */
export function nextNightTime(now: Date): Date {
  return nightTimesBetween(now, new Date(now.getTime() + 25 * 3_600_000), 1)[0];
}

/** How many nights the fire lasts if the defense stays as it is (null = it holds). */
export function nightsFireLasts(params: { fromNight: number; activeMembers: number; defense: number; fireHp: number; fireMax: number }): number | null {
  let hp = params.fireHp;
  for (let i = 0; i < 60; i++) {
    const out = resolveNight({ night: params.fromNight + i, activeMembers: params.activeMembers, defense: params.defense, fireHp: hp });
    if (out.wiped) return i + 1;
    hp = fireAfterRest(out.fireHp, params.fireMax);
  }
  return null;
}

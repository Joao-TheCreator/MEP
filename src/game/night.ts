/**
 * Night hordes and the wipe (design §15). Pure functions only; numbers live in
 * ./config (NIGHT, COMBAT, FIRE, NIGHT_REWARDS).
 */
import {
  COMBAT,
  FIRE,
  NIGHT,
  NIGHT_REWARDS,
  NIGHT_ROLES,
  NIGHT_ROLE_KEYS,
  type CharacterBonuses,
  type NightRoleKey,
} from "./config";
import { farmEffects } from "./rules";

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
export function residentPower(
  level: number,
  bonuses: Pick<CharacterBonuses, "damagePct" | "healthPct">,
  patrolled: boolean,
  role?: NightRoleKey,
): number {
  const base = COMBAT.basePower + COMBAT.powerPerLevel * (Math.max(1, level) - 1);
  const power = base * (1 + bonuses.damagePct / 100) * Math.sqrt(1 + bonuses.healthPct / 100);
  // the role only matters for those who patrolled; asleep, everyone is the same
  if (!patrolled) return power * COMBAT.restingMultiplier;
  return power * COMBAT.patrolMultiplier * (role ? NIGHT_ROLES[role].powerMultiplier : 1);
}

/** The group effects of the tanks and supports who patrolled, each with its cap. */
export function roleEffects(
  counts: Partial<Record<NightRoleKey, number>>,
  activeMembers: number,
): { damageCutPct: number; supportBoostPct: number; fireHealPct: number; hordeCutPct: number } {
  const sharePct = (n = 0) => (100 * n) / hordeMembers(activeMembers);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const R = NIGHT_ROLES;
  return {
    damageCutPct: round1(Math.min(R.tank.damageCutCapPct, R.tank.damageCutPerSharePct * sharePct(counts.tank))),
    supportBoostPct: round1(Math.min(R.support.boostCapPct, R.support.boostPerSharePct * sharePct(counts.support))),
    fireHealPct: round1(Math.min(R.healer.fireHealCapPct, R.healer.fireHealPerSharePct * sharePct(counts.healer))),
    hordeCutPct: round1(Math.min(R.scout.hordeCutCapPct, R.scout.hordeCutPerSharePct * sharePct(counts.scout))),
  };
}

export interface NightComposition {
  /** Everyone's power added up, with the supports' boost (before the farm-level bonus). */
  power: number;
  /** % less damage the fire takes, from the tanks. */
  damageCutPct: number;
  /** % more power for everyone patrolling, from the supports. */
  supportBoostPct: number;
  /** % of max HP the fire gets back after the attack, from the healers. */
  fireHealPct: number;
  /** % weaker horde, from the scouts. */
  hordeCutPct: number;
  /** How many of each role patrolled. */
  counts: Record<NightRoleKey, number>;
  /** Roles nobody is playing tonight. */
  missing: NightRoleKey[];
}

/**
 * The team of the night (design §19). `patrollers` are those who played the
 * patrol, with their role and their own power (residentPower with the role);
 * `restingPower` is the sum of everyone else. Shares are over the members the
 * horde is scaled to, and each effect is capped: past the cap, more people on
 * the same role add nothing.
 */
export function nightComposition(
  patrollers: { role: NightRoleKey; power: number }[],
  restingPower: number,
  activeMembers: number,
): NightComposition {
  const counts = Object.fromEntries(NIGHT_ROLE_KEYS.map((k) => [k, 0])) as Record<NightRoleKey, number>;
  for (const p of patrollers) counts[p.role] += 1;
  const { damageCutPct, supportBoostPct, fireHealPct, hordeCutPct } = roleEffects(counts, activeMembers);
  const patrolPower = patrollers.reduce((a, p) => a + p.power, 0);
  return {
    power: patrolPower * (1 + supportBoostPct / 100) + restingPower,
    damageCutPct,
    supportBoostPct,
    fireHealPct,
    hordeCutPct,
    counts,
    missing: NIGHT_ROLE_KEYS.filter((k) => counts[k] === 0),
  };
}

/** The whole farm's defense: everyone's power plus the farm-level bonus. */
export function farmDefense(residentPowers: number[], farmLevel: number): number {
  const sum = residentPowers.reduce((a, b) => a + b, 0);
  const pct = COMBAT.farmDefensePctPerLevel * (farmLevel - 1) + farmEffects(farmLevel).defensePct;
  return Math.round(sum * (1 + pct / 100));
}

export function fireMaxHp(activeMembers: number, farmLevel: number): number {
  const pct = FIRE.hpPctPerFarmLevel * (farmLevel - 1) + farmEffects(farmLevel).fireHpPct;
  return Math.round(FIRE.hpPerMember * hordeMembers(activeMembers) * (1 + pct / 100));
}

/** Fire HP after a day of rest (regen), before the night. The Cozinha adds to the regen. */
export function fireAfterRest(hp: number, maxHp: number, farmLevel = 1): number {
  const pct = FIRE.regenPctPerDay + farmEffects(farmLevel).fireRegenPct;
  return Math.min(maxHp, hp + Math.round((maxHp * pct) / 100));
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
export function resolveNight(params: {
  night: number;
  activeMembers: number;
  defense: number;
  fireHp: number;
  /** % of the damage the tanks hold back (design §19). */
  damageCutPct?: number;
  /** % weaker horde, from the scouts (design §19). */
  hordeCutPct?: number;
  /** % of `fireMax` the healers give back after the attack, if the fire survived (design §19). */
  fireHealPct?: number;
  fireMax?: number;
}): NightOutcome {
  const horde = Math.round(hordeStrength(params.night, params.activeMembers) * (1 - (params.hordeCutPct ?? 0) / 100));
  const damage = Math.round(Math.max(0, horde - params.defense) * (1 - (params.damageCutPct ?? 0) / 100));
  const left = Math.max(0, params.fireHp - damage);
  const heal = left > 0 && params.fireMax ? Math.round((params.fireMax * (params.fireHealPct ?? 0)) / 100) : 0;
  const fireHp = Math.min(params.fireMax ?? Infinity, left + heal);
  return { horde, defense: params.defense, damage, fireHp, wiped: left === 0 };
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
export function nightsFireLasts(params: {
  fromNight: number;
  activeMembers: number;
  defense: number;
  fireHp: number;
  fireMax: number;
  damageCutPct?: number;
  hordeCutPct?: number;
  fireHealPct?: number;
  farmLevel?: number;
}): number | null {
  let hp = params.fireHp;
  for (let i = 0; i < 60; i++) {
    const out = resolveNight({
      night: params.fromNight + i,
      activeMembers: params.activeMembers,
      defense: params.defense,
      fireHp: hp,
      damageCutPct: params.damageCutPct,
      hordeCutPct: params.hordeCutPct,
      fireHealPct: params.fireHealPct,
      fireMax: params.fireMax,
    });
    if (out.wiped) return i + 1;
    hp = fireAfterRest(out.fireHp, params.fireMax, params.farmLevel);
  }
  return null;
}

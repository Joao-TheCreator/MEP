/**
 * Season simulator for balancing (design §15.5). Pure and deterministic: it plays
 * a whole farm day by day with the real rules (production, XP, attributes,
 * talents, gear and workshop costs, buildings, hordes) and a simple spending
 * policy, until the fire goes out. Used by the balance tests and by
 * `npm run balance`, which prints the tables in docs/design.md §15.5.
 *
 * Simplifications (on purpose): resources are counted in points and trading
 * between professions is assumed to work; crafting is not modelled as a value
 * gain; patrols use their expected value (chance × bonus) instead of dice.
 */
import {
  BUILDINGS,
  PROFESSION_KEYS,
  PROFESSIONS,
  RESOURCES,
  TIER_KEYS,
  type NightRoleKey,
  type ProfessionKey,
  type TierKey,
} from "./config";
import {
  characterBonuses,
  emptyAttributes,
  gearUpgradeCost,
  levelFromXp,
  refineCost,
  talentTiersOpen,
  type GearItem,
  type TalentPicks,
} from "./character";
import { bagPoints, buildingCostScale, farmEffects, ratePerHour, storageHours, workshopUpgradeCost } from "./rules";
import { farmDefense, fireAfterRest, fireMaxHp, patrolXp, residentPower, resolveNight, roleEffects } from "./night";

export interface Archetype {
  name: string;
  /** Times the person opens the game per day (collects). */
  loginsPerDay: number;
  /** Chance of playing the night patrol. */
  patrolChance: number;
}

export const ARCHETYPES = {
  engaged: { name: "Dedicado", loginsPerDay: 3, patrolChance: 0.9 },
  regular: { name: "Regular", loginsPerDay: 2, patrolChance: 0.6 },
  casual: { name: "Casual", loginsPerDay: 1, patrolChance: 0.25 },
} as const satisfies Record<string, Archetype>;
export type ArchetypeKey = keyof typeof ARCHETYPES;

export type GroupMix = Partial<Record<ArchetypeKey, number>>;

export const GROUPS = {
  dedicated: { engaged: 8, regular: 8, casual: 4 },
  typical: { engaged: 4, regular: 8, casual: 8 },
  slow: { regular: 6, casual: 14 },
  small: { engaged: 2, regular: 2, casual: 1 },
} as const satisfies Record<string, GroupMix>;

/** How each person splits what they produce (the rest goes to the farm buildings). */
export const POLICY = { gear: 0.4, workshop: 0.3, donate: 0.3 } as const;
/** XP per point produced, from collecting (0.1), crafting ~60% of it (0.5) and donating ~30% (1). */
const XP_PER_POINT_PRODUCED = 0.1 + 0.5 * 0.6 + 1 * POLICY.donate;

/** Gear the simulation buys: what matters at night (weapon, body) and the work tool. */
const SIM_SLOTS = ["weapon", "body", "tool"] as const;
type SimSlot = (typeof SIM_SLOTS)[number];
export type SimGear = Record<SimSlot, { tier: TierKey; refine: number }>;

export function starterGear(): SimGear {
  return { weapon: { tier: "wood", refine: 0 }, body: { tier: "wood", refine: 0 }, tool: { tier: "wood", refine: 0 } };
}

interface Person {
  archetype: Archetype;
  profession: ProfessionKey;
  role: NightRoleKey;
  xp: number;
  workshop: number;
  gear: SimGear;
  wallet: { gear: number; workshop: number };
}

/** Attribute points go half to Força, half to Resistência (night-minded), then Ofício. */
function attributesFor(level: number) {
  const a = emptyAttributes();
  for (let i = 0; i < level - 1; i++) {
    if (a.strength <= a.endurance && a.strength < 20) a.strength++;
    else if (a.endurance < 20) a.endurance++;
    else a.craft++;
  }
  return a;
}

function bonusesOf(p: Person, level: number) {
  const talents: TalentPicks = Array.from({ length: talentTiersOpen(level) }, () => 0 as const);
  const gear: Partial<Record<SimSlot, GearItem>> = {};
  for (const s of SIM_SLOTS) gear[s] = { slot: s, tier: p.gear[s].tier, refine: p.gear[s].refine, kind: s === "tool" ? p.profession : undefined };
  return characterBonuses({ profession: p.profession, attributes: attributesFor(level), talents, gear });
}

/** Cheapest next gear step (tier first, then refine), in points; null when maxed. */
function nextGearStep(g: SimGear, refineDiscountPct = 0): { slot: SimSlot; kind: "tier" | "refine"; cost: number } | null {
  let best: { slot: SimSlot; kind: "tier" | "refine"; cost: number } | null = null;
  for (const slot of SIM_SLOTS) {
    const it = g[slot];
    const up = gearUpgradeCost(it.tier, slot);
    const ref = refineCost(it.refine, slot, refineDiscountPct);
    const step = up ? { slot, kind: "tier" as const, cost: bagPoints(up) } : ref ? { slot, kind: "refine" as const, cost: bagPoints(ref) } : null;
    // weapon a little cheaper to the policy: it is what wins the night
    const weight = slot === "weapon" ? 0.8 : 1;
    if (step && (!best || step.cost * weight < best.cost * (best.slot === "weapon" ? 0.8 : 1))) best = step;
  }
  return best;
}

export interface NightLog {
  night: number;
  horde: number;
  defense: number;
  fireHp: number;
  fireMax: number;
  farmLevel: number;
  avgLevel: number;
  bestWeapon: string;
}

export interface SeasonResult {
  /** Night the fire went out (null if it survived `maxNights`). */
  wipedOnNight: number | null;
  nights: NightLog[];
  /** Gear at the end, to carry into the next season. */
  gear: SimGear[];
  finalAvgLevel: number;
  farmLevel: number;
}

/** Night roles of the group: a mixed team (3 shooters, 1 tank, 1 support in every 5) or everyone shooting. */
export type TeamKind = "mixed" | "shooters";
const MIXED: NightRoleKey[] = ["shooter", "shooter", "shooter", "tank", "support"];

export function simulateSeason(mix: GroupMix, opts: { carriedGear?: SimGear[]; maxNights?: number; team?: TeamKind } = {}): SeasonResult {
  const people: Person[] = [];
  let i = 0;
  for (const [key, count] of Object.entries(mix) as [ArchetypeKey, number][]) {
    for (let c = 0; c < count; c++, i++) {
      people.push({
        archetype: ARCHETYPES[key],
        profession: PROFESSION_KEYS[i % PROFESSION_KEYS.length],
        role: opts.team === "shooters" ? "shooter" : MIXED[i % MIXED.length],
        xp: 0,
        workshop: 1,
        gear: opts.carriedGear?.[i] ? structuredClone(opts.carriedGear[i]) : starterGear(),
        wallet: { gear: 0, workshop: 0 },
      });
    }
  }
  const members = people.length;
  let farmLevel = 1;
  let buildingPoints = 0;
  let fire = fireMaxHp(members, farmLevel);
  const nights: NightLog[] = [];
  const maxNights = opts.maxNights ?? 90;

  for (let night = 1; night <= maxNights; night++) {
    // ---- day ----
    for (const p of people) {
      const level = levelFromXp(p.xp).level;
      const b = bonusesOf(p, level);
      const storage = storageHours(farmLevel) + b.storageMinutes / 60;
      const hours = p.archetype.loginsPerDay * Math.min(24 / p.archetype.loginsPerDay, storage);
      const pointsPerHour = ratePerHour(p.profession, p.workshop, farmLevel) * RESOURCES[PROFESSIONS[p.profession].produces].points;
      const produced = pointsPerHour * hours * (1 + b.productionPct / 100);
      p.xp += produced * XP_PER_POINT_PRODUCED;
      p.wallet.gear += produced * POLICY.gear;
      p.wallet.workshop += produced * POLICY.workshop;
      const building = BUILDINGS.find((x) => x.fromLevel === farmLevel);
      const donated = produced * POLICY.donate * (1 + b.donationProgressPct / 100);
      if (building) buildingPoints += donated;
      else p.wallet.gear += produced * POLICY.donate; // nothing left to build: it goes to gear

      for (;;) {
        const cost = workshopUpgradeCost(p.profession, p.workshop);
        if (!cost || p.wallet.workshop < bagPoints(cost)) break;
        p.wallet.workshop -= bagPoints(cost);
        p.workshop++;
      }
      for (;;) {
        const step = nextGearStep(p.gear, farmEffects(farmLevel).refineDiscountPct);
        if (!step || p.wallet.gear < step.cost) break;
        p.wallet.gear -= step.cost;
        const it = p.gear[step.slot];
        if (step.kind === "tier") it.tier = TIER_KEYS[TIER_KEYS.indexOf(it.tier) + 1];
        else it.refine++;
      }
    }
    for (;;) {
      const building = BUILDINGS.find((x) => x.fromLevel === farmLevel);
      const cost = bagPoints(building?.cost ?? {}) * buildingCostScale(members);
      if (!building || buildingPoints < cost) break;
      buildingPoints -= cost;
      farmLevel++;
    }

    // ---- night ----
    const fireMax = fireMaxHp(members, farmLevel);
    fire = fireAfterRest(fire, fireMax, farmLevel);
    // expected values: each person patrols with their archetype's chance, playing their role
    const expected = { tank: 0, support: 0 };
    let patrolPower = 0;
    let restPower = 0;
    for (const p of people) {
      const level = levelFromXp(p.xp).level;
      const c = p.archetype.patrolChance;
      const b = bonusesOf(p, level);
      patrolPower += residentPower(level, b, true, p.role) * c;
      restPower += residentPower(level, b, false) * (1 - c);
      if (p.role !== "shooter") expected[p.role] += c;
    }
    const fx = roleEffects(expected, members);
    const out = resolveNight({
      night,
      activeMembers: members,
      defense: farmDefense([patrolPower * (1 + fx.supportBoostPct / 100) + restPower], farmLevel),
      fireHp: fire,
      damageCutPct: fx.damageCutPct,
    });
    fire = out.fireHp;
    const levels = people.map((p) => levelFromXp(p.xp).level);
    const best = people.reduce((a, p) => Math.max(a, TIER_KEYS.indexOf(p.gear.weapon.tier)), 0);
    nights.push({
      night,
      horde: out.horde,
      defense: out.defense,
      fireHp: out.fireHp,
      fireMax,
      farmLevel,
      avgLevel: Math.round((levels.reduce((a, b) => a + b, 0) / members) * 10) / 10,
      bestWeapon: TIER_KEYS[best],
    });
    if (out.wiped) {
      return { wipedOnNight: night, nights, gear: people.map((p) => p.gear), finalAvgLevel: nights.at(-1)!.avgLevel, farmLevel };
    }
    for (const p of people) p.xp += patrolXp(night) * p.archetype.patrolChance;
  }
  return { wipedOnNight: null, nights, gear: people.map((p) => p.gear), finalAvgLevel: nights.at(-1)!.avgLevel, farmLevel };
}

/** Several seasons in a row, carrying the gear (the only thing a wipe keeps). */
export function simulateSeasons(mix: GroupMix, seasons: number, team: TeamKind = "mixed"): SeasonResult[] {
  const out: SeasonResult[] = [];
  let gear: SimGear[] | undefined;
  for (let s = 0; s < seasons; s++) {
    const r = simulateSeason(mix, { carriedGear: gear, team });
    out.push(r);
    gear = r.gear;
  }
  return out;
}

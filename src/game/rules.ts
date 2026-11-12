import {
  BUILDINGS,
  BUILDING_SCALE,
  FARM,
  PROFESSION_CHANGE,
  PROFESSION_KEYS,
  PROFESSIONS,
  RECIPES,
  RESOURCES,
  WORKSHOP,
  type Bag,
  type Building,
  type ProfessionKey,
  type RecipeKey,
  type ResourceKey,
} from "./config";

const MS_PER_HOUR = 3_600_000n;

/**
 * Production rate in milli-units per hour (integer, exact).
 * rate = base × (1 + 0.25·(workshop−1)) × (1 + 0.10·(farm−1))
 */
export function rateMilliPerHour(
  profession: ProfessionKey,
  workshopLevel: number,
  farmLevel: number,
): bigint {
  const base = BigInt(PROFESSIONS[profession].baseRatePerHour);
  const w = BigInt(100 + WORKSHOP.bonusPercentPerLevel * (workshopLevel - 1));
  const f = BigInt(100 + FARM.bonusPercentPerLevel * (farmLevel - 1));
  // base × 1000 × (w/100) × (f/100)
  return (base * 1000n * w * f) / 10_000n;
}

export function ratePerHour(profession: ProfessionKey, workshopLevel: number, farmLevel: number) {
  return Number(rateMilliPerHour(profession, workshopLevel, farmLevel)) / 1000;
}

/** Storage (max offline accumulation) in hours, given the farm level. */
export function storageHours(farmLevel: number): number {
  let hours = FARM.baseStorageHours;
  for (const b of BUILDINGS) {
    if (farmLevel > b.fromLevel) hours += b.effect.storageHoursBonus ?? 0;
  }
  return hours;
}

export interface ProductionResult {
  units: number;
  /** New value for last_collected_at. */
  newLastCollectedAt: Date;
  /** True if storage was full and some production was lost. */
  capped: boolean;
}

/**
 * Computes production since lastCollectedAt, purely from timestamps.
 * Keeps the fractional remainder by advancing the timestamp only by the time
 * "spent" on whole units (unless storage overflowed).
 */
export function computeProduction(params: {
  profession: ProfessionKey;
  workshopLevel: number;
  farmLevel: number;
  lastCollectedAt: Date;
  now: Date;
}): ProductionResult {
  const { profession, workshopLevel, farmLevel, lastCollectedAt, now } = params;
  const rate = rateMilliPerHour(profession, workshopLevel, farmLevel);
  const capMs = BigInt(storageHours(farmLevel)) * MS_PER_HOUR;
  const realElapsed = BigInt(Math.max(0, now.getTime() - lastCollectedAt.getTime()));
  const capped = realElapsed > capMs;
  const elapsed = capped ? capMs : realElapsed;

  const units = (rate * elapsed) / (1000n * MS_PER_HOUR);

  let newLast: Date;
  if (capped) {
    newLast = now;
  } else {
    // ceil(units × 1000 × 1h / rate) ≤ elapsed — never gives extra time.
    const num = units * 1000n * MS_PER_HOUR;
    const spent = rate === 0n ? elapsed : (num + rate - 1n) / rate;
    newLast = new Date(lastCollectedAt.getTime() + Number(spent));
  }
  return { units: Number(units), newLastCollectedAt: newLast, capped };
}

function scaleCost(base: Bag, level: number): Bag {
  const factor = Math.pow(WORKSHOP.costGrowth, level - 1);
  const out: Bag = {};
  for (const [k, v] of Object.entries(base) as [ResourceKey, number][]) {
    // round to 6 decimals first to dodge float noise like 51.200000000000004
    out[k] = Math.ceil(Math.round(v * factor * 1e6) / 1e6);
  }
  return out;
}

/** Cost to upgrade a workshop from `level` to `level + 1`, or null at max level. */
export function workshopUpgradeCost(profession: ProfessionKey, level: number): Bag | null {
  if (level >= WORKSHOP.maxLevel) return null;
  return scaleCost(PROFESSIONS[profession].workshop.baseCost, level);
}

export function recipeInputs(recipe: RecipeKey, times: number): Bag {
  const out: Bag = {};
  for (const [k, v] of Object.entries(RECIPES[recipe].inputs) as [ResourceKey, number][]) {
    out[k] = v * times;
  }
  return out;
}

/** How many times a recipe can be crafted with the given inventory. */
export function maxCraftable(recipe: RecipeKey, inventory: Bag): number {
  let max = Infinity;
  for (const [k, v] of Object.entries(RECIPES[recipe].inputs) as [ResourceKey, number][]) {
    max = Math.min(max, Math.floor((inventory[k] ?? 0) / v));
  }
  return Number.isFinite(max) ? max : 0;
}

export function hasEnough(inventory: Bag, cost: Bag): boolean {
  return (Object.entries(cost) as [ResourceKey, number][]).every(
    ([k, v]) => (inventory[k] ?? 0) >= v,
  );
}

export function bagPoints(bag: Bag): number {
  return (Object.entries(bag) as [ResourceKey, number][]).reduce(
    (sum, [k, v]) => sum + RESOURCES[k].points * v,
    0,
  );
}

/** The building currently being built at this farm level (null when all done). */
export function currentBuilding(farmLevel: number): Building | null {
  return BUILDINGS.find((b) => b.fromLevel === farmLevel) ?? null;
}

/** Remaining amounts for the current building, given donated progress. */
export function remainingForBuilding(building: Building, progress: Bag): Bag {
  const out: Bag = {};
  for (const [k, v] of Object.entries(building.cost) as [ResourceKey, number][]) {
    out[k] = Math.max(0, v - (progress[k] ?? 0));
  }
  return out;
}

export function isBuildingComplete(building: Building, progress: Bag): boolean {
  return Object.values(remainingForBuilding(building, progress)).every((v) => v === 0);
}

// ---------- professions on the farm ----------

/** How many residents have each profession (every profession present, 0 if none). */
export function countProfessions(professions: ProfessionKey[]): Record<ProfessionKey, number> {
  const counts = Object.fromEntries(PROFESSION_KEYS.map((k) => [k, 0])) as Record<ProfessionKey, number>;
  for (const p of professions) counts[p] += 1;
  return counts;
}

/** Professions nobody on the farm has yet (the farm can get stuck without them). */
export function missingProfessions(counts: Record<ProfessionKey, number>): ProfessionKey[] {
  return PROFESSION_KEYS.filter((k) => counts[k] === 0);
}

/** Cost to leave `current`: costHours of its base production, in its raw resource. */
export function professionChangeCost(current: ProfessionKey): Bag {
  const p = PROFESSIONS[current];
  return { [p.produces]: p.baseRatePerHour * PROFESSION_CHANGE.costHours };
}

/** When the player may change profession again (null = right now). */
export function professionChangeAvailableAt(lastChangedAt: Date | null, now: Date): Date | null {
  if (!lastChangedAt) return null;
  const at = new Date(lastChangedAt.getTime() + PROFESSION_CHANGE.cooldownHours * 3_600_000);
  return at > now ? at : null;
}

/**
 * Collective buildings cost more on bigger farms (#4): the listed cost is for
 * BUILDING_SCALE.referenceMembers active members and grows linearly with them.
 */
export function buildingCostScale(activeMembers: number): number {
  return Math.max(1, activeMembers / BUILDING_SCALE.referenceMembers);
}

/** Effects of every finished building at this farm level, added up (design §20). */
export function farmEffects(farmLevel: number) {
  const total = { marketBuyPct: null as number | null, defensePct: 0, fireHpPct: 0, fireRegenPct: 0, refineDiscountPct: 0 };
  for (const b of BUILDINGS) {
    if (farmLevel <= b.fromLevel) continue;
    const e = b.effect;
    if (e.marketBuyPct !== undefined) total.marketBuyPct = Math.min(total.marketBuyPct ?? Infinity, e.marketBuyPct);
    total.defensePct += e.defensePct ?? 0;
    total.fireHpPct += e.fireHpPct ?? 0;
    total.fireRegenPct += e.fireRegenPct ?? 0;
    total.refineDiscountPct += e.refineDiscountPct ?? 0;
  }
  return total;
}

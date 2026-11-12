/**
 * Backpack (design §21): gear items found on patrols, kept through wipes,
 * equipped or dismantled. Pure functions; numbers in BACKPACK (./config).
 */
import { BACKPACK, BAG, SLOT_KEYS, TIER_KEYS, type Bag, type ResourceKey, type SlotKey, type TierKey } from "./config";
import { bagPagesOpen, gearUpgradeCost, refineCost } from "./character";
import { rng } from "./patrol";

/** One gear item, in the backpack or worn. */
export interface BagItem {
  id: string;
  slot: SlotKey;
  tier: TierKey;
  refine: number;
}

/** Items the backpack holds at this character level. */
export function bagCapacity(level: number): number {
  return BAG.slotsPerPage * bagPagesOpen(level);
}

/** The tier a night's drops are made of, and the chance of one tier lower. */
function tierForNight(night: number): { tier: TierKey; lowerChance: number } {
  let pick = BACKPACK.dropTiers[0];
  for (const t of BACKPACK.dropTiers) if (night >= t[0]) pick = t;
  return { tier: pick[1], lowerChance: pick[2] };
}

/**
 * Gear found on a patrol: one roll per star (design §21). Uses the run's seed,
 * so the server decides and replaying gives the same items.
 */
export function rollGearDrops(stars: number, night: number, seed: number, extraRolls = 0): BagItem[] {
  const n = Math.max(1, Math.floor(night));
  const rand = rng((seed ^ 0x5bd1e995) >>> 0);
  const out: BagItem[] = [];
  const rolls = stars > 0 ? stars + Math.max(0, extraRolls) : 0;
  for (let i = 0; i < rolls; i++) {
    if (rand() >= BACKPACK.dropChancePerStar) continue;
    const slot = SLOT_KEYS[Math.floor(rand() * SLOT_KEYS.length)];
    const { tier, lowerChance } = tierForNight(n);
    const idx = TIER_KEYS.indexOf(tier);
    const finalTier = rand() < lowerChance && idx > 1 ? TIER_KEYS[idx - 1] : tier;
    const maxRefine = n >= BACKPACK.refineFromNight ? Math.floor(n / BACKPACK.refinePerNights) : 0;
    const refine = Math.floor(rand() * (maxRefine + 1));
    out.push({ id: `${seed.toString(36)}-${i}`, slot, tier: finalTier, refine });
  }
  return out;
}

/**
 * Materials given back for dismantling an item: dismantlePct of what it would
 * cost to upgrade a wooden one up to its tier and refine it, in its own slot.
 */
export function dismantleValue(item: Pick<BagItem, "slot" | "tier" | "refine">): Bag {
  const total: Record<string, number> = {};
  const add = (bag: Bag | null) => {
    for (const [k, v] of Object.entries(bag ?? {}) as [ResourceKey, number][]) total[k] = (total[k] ?? 0) + v;
  };
  for (let i = 0; i < TIER_KEYS.indexOf(item.tier); i++) add(gearUpgradeCost(TIER_KEYS[i], item.slot));
  for (let r = 0; r < item.refine; r++) add(refineCost(r, item.slot));
  const out: Bag = {};
  for (const [k, v] of Object.entries(total) as [ResourceKey, number][]) {
    const back = Math.floor((v * BACKPACK.dismantlePct) / 100);
    if (back > 0) out[k] = back;
  }
  return out;
}

/** A wooden +0 item is worth nothing: it is never kept in the backpack. */
export function isWorthless(item: Pick<BagItem, "tier" | "refine">): boolean {
  return item.tier === "wood" && item.refine === 0;
}

/**
 * Puts found items in the backpack while there is room. What does not fit is
 * dismantled on the spot; the materials come back in `dismantled`.
 */
export function addToBag(bag: BagItem[], found: BagItem[], capacity: number): { bag: BagItem[]; kept: BagItem[]; dismantled: Bag } {
  const next = [...bag];
  const kept: BagItem[] = [];
  const dismantled: Bag = {};
  for (const item of found) {
    if (isWorthless(item)) continue;
    if (next.length < capacity) {
      next.push(item);
      kept.push(item);
    } else {
      for (const [k, v] of Object.entries(dismantleValue(item)) as [ResourceKey, number][]) dismantled[k] = (dismantled[k] ?? 0) + v;
    }
  }
  return { bag: next, kept, dismantled };
}

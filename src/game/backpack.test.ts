import { describe, expect, it } from "vitest";
import { BACKPACK, TIER_KEYS } from "./config";
import { addToBag, bagCapacity, dismantleValue, isWorthless, rollGearDrops, type BagItem } from "./backpack";

describe("gear found on patrols (design §21)", () => {
  it("is decided by the seed", () => {
    expect(rollGearDrops(3, 12, 777)).toEqual(rollGearDrops(3, 12, 777));
    expect(rollGearDrops(0, 12, 777)).toEqual([]);
  });

  it("drops about 10% of the stars", () => {
    let items = 0;
    const runs = 2000;
    for (let seed = 1; seed <= runs; seed++) items += rollGearDrops(3, 5, seed).length;
    const rate = items / (runs * 3);
    expect(rate).toBeGreaterThan(BACKPACK.dropChancePerStar * 0.8);
    expect(rate).toBeLessThan(BACKPACK.dropChancePerStar * 1.2);
  });

  it("finds better tiers on later nights, never diamond", () => {
    const tiersOn = (night: number) => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 3000; seed++) for (const it of rollGearDrops(3, night, seed)) seen.add(it.tier);
      return [...seen].sort((a, b) => TIER_KEYS.indexOf(a as never) - TIER_KEYS.indexOf(b as never));
    };
    expect(tiersOn(3)).toEqual(["bronze"]);
    expect(tiersOn(10)).toEqual(["bronze", "iron"]);
    expect(tiersOn(18)).toEqual(["iron", "silver"]);
    expect(tiersOn(40)).toEqual(["silver", "gold"]);
  });

  it("comes refined only from night 10 on, up to night ÷ 10", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      for (const it of rollGearDrops(3, 9, seed)) expect(it.refine).toBe(0);
      for (const it of rollGearDrops(3, 25, seed)) expect(it.refine).toBeLessThanOrEqual(2);
    }
  });
});

describe("backpack", () => {
  it("holds 48 items, 72 from level 15", () => {
    expect(bagCapacity(1)).toBe(48);
    expect(bagCapacity(15)).toBe(72);
  });

  it("dismantling gives back half of what the item costs to make, in its own slot", () => {
    expect(dismantleValue({ slot: "weapon", tier: "bronze", refine: 0 })).toEqual({ plank: 5, iron_bar: 2 });
    expect(dismantleValue({ slot: "body", tier: "bronze", refine: 0 })).toEqual({ cheese: 3, plank: 5 });
    expect(dismantleValue({ slot: "weapon", tier: "wood", refine: 0 })).toEqual({});
    // iron = wood→bronze + bronze→iron, plus one refine
    expect(dismantleValue({ slot: "weapon", tier: "iron", refine: 1 })).toEqual({ plank: 14, iron_bar: 7, tool: 2 });
    expect(isWorthless({ tier: "wood", refine: 0 })).toBe(true);
    expect(isWorthless({ tier: "wood", refine: 1 })).toBe(false);
  });

  it("keeps what fits and dismantles the rest", () => {
    const item = (id: string): BagItem => ({ id, slot: "hat", tier: "bronze", refine: 0 });
    const r = addToBag([item("a")], [item("b"), item("c"), { id: "w", slot: "hat", tier: "wood", refine: 0 }], 2);
    expect(r.bag.map((i) => i.id)).toEqual(["a", "b"]);
    expect(r.kept.map((i) => i.id)).toEqual(["b"]);
    expect(r.dismantled).toEqual(dismantleValue(item("c")));
  });
});

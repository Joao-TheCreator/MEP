import { describe, expect, it } from "vitest";
import { BUILDINGS, PROFESSION_CHANGE, PROFESSIONS, RECIPES, RESOURCES, type ResourceKey } from "./config";
import {
  bagPoints,
  computeProduction,
  countProfessions,
  currentBuilding,
  farmEffects,
  isBuildingComplete,
  maxCraftable,
  missingProfessions,
  professionChangeAvailableAt,
  professionChangeCost,
  ratePerHour,
  remainingForBuilding,
  storageHours,
  workshopUpgradeCost,
} from "./rules";

const H = 3_600_000;
const t0 = new Date("2026-01-05T12:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("production rate", () => {
  it("every profession yields 60 points/hour at level 1 (design §3)", () => {
    for (const p of Object.values(PROFESSIONS)) {
      expect(p.baseRatePerHour * RESOURCES[p.produces].points).toBe(60);
    }
  });

  it("applies workshop and farm bonuses (design §4)", () => {
    expect(ratePerHour("farmer", 1, 1)).toBe(60);
    expect(ratePerHour("farmer", 5, 1)).toBe(120);
    expect(ratePerHour("farmer", 5, 4)).toBe(156);
    expect(ratePerHour("rancher", 5, 4)).toBe(78);
    expect(ratePerHour("farmer", 2, 2)).toBe(82.5);
  });
});

describe("computeProduction", () => {
  const base = { profession: "farmer" as const, workshopLevel: 1, farmLevel: 1, lastCollectedAt: t0 };

  it("produces nothing for zero or negative elapsed time", () => {
    expect(computeProduction({ ...base, now: t0 }).units).toBe(0);
    expect(computeProduction({ ...base, now: at(-5000) }).units).toBe(0);
  });

  it("produces rate × hours", () => {
    const r = computeProduction({ ...base, now: at(2 * H) });
    expect(r.units).toBe(120);
    expect(r.capped).toBe(false);
    expect(r.newLastCollectedAt.getTime()).toBe(at(2 * H).getTime());
  });

  it("keeps the fractional remainder between collections", () => {
    // 60/h = 1 per minute. Collect at 90s → 1 unit, timestamp advances 60s only.
    const r1 = computeProduction({ ...base, now: at(90_000) });
    expect(r1.units).toBe(1);
    expect(r1.newLastCollectedAt.getTime()).toBe(at(60_000).getTime());
    const r2 = computeProduction({ ...base, lastCollectedAt: r1.newLastCollectedAt, now: at(120_000) });
    expect(r2.units).toBe(1);
  });

  it("many small collections never beat one big collection", () => {
    const params = { ...base, profession: "rancher" as const, workshopLevel: 3, farmLevel: 2 };
    const end = at(5 * H + 12_345);
    const big = computeProduction({ ...params, now: end }).units;
    let last = t0;
    let total = 0;
    for (let t = 7_777; t <= end.getTime() - t0.getTime(); t += 7_777) {
      const r = computeProduction({ ...params, lastCollectedAt: last, now: at(t) });
      total += r.units;
      last = r.newLastCollectedAt;
    }
    total += computeProduction({ ...params, lastCollectedAt: last, now: end }).units;
    expect(total).toBe(big);
  });

  it("caps at storage hours and drops the excess", () => {
    const r = computeProduction({ ...base, now: at(20 * H) });
    expect(r.units).toBe(60 * 8);
    expect(r.capped).toBe(true);
    expect(r.newLastCollectedAt.getTime()).toBe(at(20 * H).getTime());
  });

  it("barn raises storage to 12h", () => {
    expect(storageHours(1)).toBe(8);
    expect(storageHours(2)).toBe(8);
    expect(storageHours(3)).toBe(12);
    expect(storageHours(4)).toBe(12);
  });
});

describe("workshop costs", () => {
  it("matches design §6", () => {
    expect(workshopUpgradeCost("farmer", 1)).toEqual({ plank: 20, tool: 2, grain: 100 });
    expect(workshopUpgradeCost("farmer", 2)).toEqual({ plank: 32, tool: 4, grain: 160 });
    expect(workshopUpgradeCost("farmer", 4)).toEqual({ plank: 82, tool: 9, grain: 410 });
    expect(workshopUpgradeCost("farmer", 10)).toBeNull();
  });
});

describe("recipes", () => {
  it("crafted goods are worth ~20% more than inputs (design §5)", () => {
    for (const r of Object.values(RECIPES)) {
      const inPts = bagPoints(r.inputs);
      const outPts = RESOURCES[r.output].points;
      expect(outPts).toBe(Math.ceil(Math.round(inPts * 1.2 * 1e6) / 1e6));
    }
  });

  it("maxCraftable uses the scarcest input", () => {
    expect(maxCraftable("iron_bar", { ore: 10, wood: 5 })).toBe(2);
    expect(maxCraftable("plank", {})).toBe(0);
  });
});

describe("buildings", () => {
  it("first three buildings and their point totals (design §7)", () => {
    expect(BUILDINGS.slice(0, 3).map((b) => b.key)).toEqual(["well", "barn", "mill"]);
    expect(BUILDINGS.slice(0, 3).map((b) => bagPoints(b.cost))).toEqual([1340, 3520, 6360]);
  });

  it("tracks remaining and completion", () => {
    const well = currentBuilding(1)!;
    expect(well.key).toBe("well");
    const progress = { wood: 400, ore: 200, grain: 300, plank: 59 };
    expect(remainingForBuilding(well, progress)).toEqual({ wood: 0, ore: 0, grain: 0, plank: 1 });
    expect(isBuildingComplete(well, progress)).toBe(false);
    expect(isBuildingComplete(well, { ...progress, plank: 60 })).toBe(true);
    expect(currentBuilding(4)!.key).toBe("shop");
    expect(currentBuilding(BUILDINGS.length + 1)).toBeNull();
  });

  it("the later buildings come in order, each dearer than the one before (design §20)", () => {
    expect(BUILDINGS.map((b) => b.key)).toEqual(["well", "barn", "mill", "shop", "fence", "tower", "kitchen", "smithy"]);
    expect(BUILDINGS.map((b) => b.fromLevel)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const points = BUILDINGS.map((b) => bagPoints(b.cost));
    for (let i = 1; i < points.length; i++) expect(points[i]).toBeGreaterThan(points[i - 1]);
  });

  it("finished buildings add up their effects", () => {
    expect(farmEffects(4)).toEqual({ marketBuyPct: null, defensePct: 0, fireHpPct: 0, fireRegenPct: 0, refineDiscountPct: 0 });
    expect(farmEffects(5).marketBuyPct).toBe(170);
    expect(farmEffects(6).defensePct).toBe(15);
    expect(farmEffects(7).fireHpPct).toBe(25);
    expect(farmEffects(8).fireRegenPct).toBe(15);
    expect(farmEffects(9)).toEqual({ marketBuyPct: 170, defensePct: 15, fireHpPct: 25, fireRegenPct: 15, refineDiscountPct: 15 });
  });

  it("only uses known resources", () => {
    const keys = Object.keys(RESOURCES);
    for (const b of BUILDINGS) for (const k of Object.keys(b.cost)) expect(keys).toContain(k as ResourceKey);
  });
});

describe("professions on the farm (design §2.1)", () => {
  it("counts every profession, including missing ones", () => {
    const counts = countProfessions(["farmer", "farmer", "carpenter"]);
    expect(counts).toEqual({ farmer: 2, rancher: 0, carpenter: 1, blacksmith: 0 });
    expect(missingProfessions(counts)).toEqual(["rancher", "blacksmith"]);
    expect(missingProfessions(countProfessions(["farmer", "rancher", "carpenter", "blacksmith"]))).toEqual([]);
  });

  it("changing costs 4 h of the current profession's base production (240 points)", () => {
    expect(PROFESSION_CHANGE.costHours).toBe(4);
    expect(professionChangeCost("farmer")).toEqual({ grain: 240 });
    expect(professionChangeCost("rancher")).toEqual({ milk: 120 });
    expect(professionChangeCost("carpenter")).toEqual({ wood: 240 });
    expect(professionChangeCost("blacksmith")).toEqual({ ore: 120 });
    for (const k of Object.keys(PROFESSIONS) as (keyof typeof PROFESSIONS)[]) {
      expect(bagPoints(professionChangeCost(k))).toBe(240);
    }
  });

  it("allows one change per 24 h", () => {
    expect(PROFESSION_CHANGE.cooldownHours).toBe(24);
    expect(professionChangeAvailableAt(null, t0)).toBeNull();
    expect(professionChangeAvailableAt(at(-23 * H), t0)).toEqual(at(H));
    expect(professionChangeAvailableAt(at(-24 * H), t0)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { PATROL, RESOURCES, type ResourceKey } from "./config";
import { bagPoints } from "./rules";
import {
  MAX_TICKS, STEP, advance, createNight, fireSpecial, nightResult, patrolRewards, replayPatrol, specialReady,
  validSpecialTicks, type HeroClass,
} from "./patrol";

/** Plays like a phone: steps in frames of 1 or 2 ticks and fires the special as soon as it is ready. */
function playOnPhone(cls: HeroClass, seed: number, speed: 1 | 2, useSpecial = true) {
  const s = createNight(cls, seed);
  while (s.phase !== "won" && s.phase !== "lost" && s.ticks < MAX_TICKS) {
    if (useSpecial && specialReady(s)) fireSpecial(s);
    advance(s, STEP * speed);
  }
  return s;
}

describe("patrol replay (design §18)", () => {
  for (const cls of ["volei", "colchonete"] as const) {
    it(`${cls}: the server replay gives exactly the phone's result`, () => {
      for (const seed of [1, 42, 999_999]) {
        const phone = playOnPhone(cls, seed, 1);
        expect(replayPatrol(cls, seed, phone.specialTicks)).toEqual(nightResult(phone));
      }
    });
  }

  it("ignores specials the hero could not have fired (no free wins)", () => {
    const honest = replayPatrol("volei", 5, []);
    const cheat = replayPatrol("volei", 5, Array.from({ length: 150 }, (_, i) => i));
    // firing "every tick" only lands when the special is really charged: never better than playing well
    const good = nightResult(playOnPhone("volei", 5, 1));
    expect(cheat.stars).toBeLessThanOrEqual(good.stars);
    expect(honest.stars).toBeLessThanOrEqual(good.stars);
  });

  it("rejects malformed special lists", () => {
    expect(validSpecialTicks([3, 40, 90])).toBe(true);
    expect(validSpecialTicks([])).toBe(true);
    expect(validSpecialTicks([40, 3])).toBe(false);
    expect(validSpecialTicks([3, 3])).toBe(false);
    expect(validSpecialTicks([1.5])).toBe(false);
    expect(validSpecialTicks([-1])).toBe(false);
    expect(validSpecialTicks([MAX_TICKS])).toBe(false);
    expect(validSpecialTicks("3,4")).toBe(false);
    expect(validSpecialTicks(Array.from({ length: PATROL.maxSpecials + 1 }, (_, i) => i))).toBe(false);
  });
});

describe("patrol rewards (design §18)", () => {
  it("pays coins per star and one loot roll per star", () => {
    const r = patrolRewards(3, 1, 7);
    expect(r.coins).toBe(3 * 12);
    const units = Object.values(r.loot).reduce((a, b) => a + b, 0);
    expect(units).toBeGreaterThanOrEqual(3);
    // each roll is worth at most the budget (15 points on night 1), at least one unit
    expect(bagPoints(r.loot)).toBeLessThanOrEqual(3 * Math.max(15, RESOURCES.tool.points));
  });

  it("a lost patrol gives only a few coins", () => {
    expect(patrolRewards(0, 9, 7)).toEqual({ coins: PATROL.consolationCoins, loot: {} });
  });

  it("is the same for the same seed and grows with the night", () => {
    expect(patrolRewards(2, 4, 123)).toEqual(patrolRewards(2, 4, 123));
    const early = patrolRewards(3, 1, 123);
    const late = patrolRewards(3, 20, 123);
    expect(late.coins).toBeGreaterThan(early.coins);
    expect(bagPoints(late.loot)).toBeGreaterThan(bagPoints(early.loot));
  });

  it("drops every material over many patrols, mostly made goods", () => {
    const seen: Record<string, number> = {};
    for (let seed = 1; seed <= 600; seed++) {
      for (const k of Object.keys(patrolRewards(3, 5, seed).loot)) seen[k] = (seen[k] ?? 0) + 1;
    }
    expect(Object.keys(seen).sort()).toEqual(Object.keys(PATROL.lootWeights).sort());
    expect(seen.plank).toBeGreaterThan(seen.milk);
  });

  it("three expeditions a day at 3 stars are worth less than a day of level-1 production", () => {
    let points = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = patrolRewards(3, 1, seed);
      points += r.coins + bagPoints(r.loot);
    }
    const perRun = points / 300;
    // a level-1 farmer makes 60 points/hour
    expect(perRun * (1 + PATROL.expeditionsPerDay)).toBeLessThan(60 * 24 * 0.5);
    expect((Object.keys(PATROL.lootWeights) as ResourceKey[]).every((k) => RESOURCES[k])).toBe(true);
  });
});

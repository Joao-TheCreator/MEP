import { describe, expect, it } from "vitest";
import { advance, createNight, fireSpecial, nightResult, specialReady, type HeroClass } from "./sim";

function play(cls: HeroClass, seed: number, useSpecials: boolean) {
  const s = createNight(cls, seed);
  while (s.phase !== "won" && s.phase !== "lost" && s.t < 600) {
    advance(s, 0.25);
    if (useSpecials && specialReady(s)) fireSpecial(s);
  }
  return s;
}

describe("night prototype", () => {
  it("is deterministic for the same seed", () => {
    const a = play("volei", 7, true);
    const b = play("volei", 7, true);
    expect([a.t, a.camp.hp, a.kills]).toEqual([b.t, b.camp.hp, b.kills]);
  });

  for (const cls of ["volei", "colchonete", "violao", "cozinheira", "lanterna"] as const) {
    it(`${cls}: a night ends in a few minutes`, () => {
      const s = play(cls, 3, true);
      expect(["won", "lost"]).toContain(s.phase);
      expect(s.t).toBeGreaterThan(40);
      expect(s.t).toBeLessThan(180);
    });

    it(`${cls}: using the special usually wins`, () => {
      const wins = [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) => nightResult(play(cls, seed, true)).won).length;
      expect(wins).toBeGreaterThanOrEqual(6);
    });

    it(`${cls}: the special makes a difference`, () => {
      const camp = (on: boolean) =>
        [1, 2, 3, 4, 5, 6].reduce((sum, seed) => sum + play(cls, seed, on).camp.hp, 0);
      expect(camp(true)).toBeGreaterThan(camp(false));
    });
  }

  it("special needs full energy", () => {
    const s = createNight("colchonete", 1);
    expect(fireSpecial(s)).toBe(false);
    s.hero.energy = 100;
    expect(fireSpecial(s)).toBe(true);
    expect(s.hero.energy).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_DARKNESS, darkness, farmHour, isNight } from "./daylight";
import { spriteSize } from "./pixel";
import { CROPS, FORGE, MAP_FIRE, MAP_FIRE_LOW, PEN, SAWMILL } from "./workplaces";
import { FENCE, KITCHEN, SHOP, SMITHY, TOWER } from "./buildings";

describe("daylight on the farm map", () => {
  it("reads the hour in Brasília", () => {
    expect(farmHour(new Date("2026-11-12T23:00:00Z"))).toBe(20);
    expect(farmHour(new Date("2026-11-12T02:30:00Z"))).toBe(23.5);
  });

  it("is bright by day, dark at night, and fades in between", () => {
    expect(darkness(12)).toBe(0);
    expect(darkness(22)).toBe(MAX_DARKNESS);
    expect(darkness(2)).toBe(MAX_DARKNESS);
    expect(darkness(18.5)).toBeCloseTo(MAX_DARKNESS / 2);
    expect(darkness(6)).toBeCloseTo(MAX_DARKNESS / 2);
    expect(darkness(19)).toBeGreaterThan(darkness(18));
  });

  it("night for the residents runs from 18h to 6h", () => {
    expect(isNight(17.9)).toBe(false);
    expect(isNight(18)).toBe(true);
    expect(isNight(3)).toBe(true);
    expect(isNight(6)).toBe(false);
  });
});

describe("work place sprites", () => {
  const all = { CROPS, PEN, SAWMILL, FORGE, SHOP, FENCE, TOWER, KITCHEN, SMITHY, fire0: MAP_FIRE[0], fire1: MAP_FIRE[1], low0: MAP_FIRE_LOW[0], low1: MAP_FIRE_LOW[1] };
  for (const [name, s] of Object.entries(all)) {
    it(`${name}: rows have the same width and every color is defined`, () => {
      const { w } = spriteSize(s);
      for (const row of s.rows) {
        expect(row.length).toBe(w);
        for (const ch of row) if (ch !== ".") expect(s.colors[ch], `color "${ch}"`).toBeTruthy();
      }
    });
  }

  it("the low fire keeps the logs and the frame size", () => {
    expect(spriteSize(MAP_FIRE_LOW[0])).toEqual(spriteSize(MAP_FIRE[0]));
  });
});

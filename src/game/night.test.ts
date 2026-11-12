import { describe, expect, it } from "vitest";
import { COMBAT, FIRE, NIGHT } from "./config";
import { farmDefense, fireAfterRest, fireMaxHp, hordeMembers, hordeStrength, nextNightTime, nightTimesBetween, nightsFireLasts, patrolXp, residentPower, resolveNight } from "./night";

const noBonus = { damagePct: 0, healthPct: 0 };

describe("night hordes", () => {
  it("grows every night and scales with active members (never below the minimum)", () => {
    expect(hordeStrength(2, 20)).toBeGreaterThan(hordeStrength(1, 20));
    expect(hordeStrength(1, 20)).toBe(NIGHT.baseHordePerMember * 20);
    expect(hordeMembers(1)).toBe(NIGHT.minMembersForHorde);
    expect(hordeStrength(1, 1)).toBe(hordeStrength(1, NIGHT.minMembersForHorde));
  });

  it("patrolling triples a resident's power compared to resting", () => {
    const on = residentPower(1, noBonus, true);
    const off = residentPower(1, noBonus, false);
    expect(on).toBe(COMBAT.basePower * COMBAT.patrolMultiplier);
    expect(on / off).toBeCloseTo(COMBAT.patrolMultiplier / COMBAT.restingMultiplier);
  });

  it("level, weapon damage and armour health all raise power", () => {
    const base = residentPower(1, noBonus, false);
    expect(residentPower(10, noBonus, false)).toBeGreaterThan(base);
    expect(residentPower(1, { damagePct: 50, healthPct: 0 }, false)).toBeCloseTo(base * 1.5);
    expect(residentPower(1, { damagePct: 0, healthPct: 300 }, false)).toBeCloseTo(base * 2);
  });

  it("farm level adds defense and fire HP", () => {
    expect(farmDefense([10, 10], 3)).toBeGreaterThan(farmDefense([10, 10], 1));
    expect(fireMaxHp(20, 3)).toBeGreaterThan(fireMaxHp(20, 1));
    expect(fireMaxHp(20, 1)).toBe(FIRE.hpPerMember * 20);
  });

  it("the fire only burns by what the defense does not stop, and wipes at 0", () => {
    const held = resolveNight({ night: 1, activeMembers: 20, defense: 10_000, fireHp: 100 });
    expect(held).toMatchObject({ damage: 0, fireHp: 100, wiped: false });
    const horde = hordeStrength(5, 20);
    const hurt = resolveNight({ night: 5, activeMembers: 20, defense: horde - 30, fireHp: 100 });
    expect(hurt).toMatchObject({ damage: 30, fireHp: 70, wiped: false });
    expect(resolveNight({ night: 5, activeMembers: 20, defense: 0, fireHp: 100 }).wiped).toBe(true);
  });

  it("the fire recovers part of its HP each day, up to the max", () => {
    expect(fireAfterRest(0, 1000)).toBe((1000 * FIRE.regenPctPerDay) / 100);
    expect(fireAfterRest(990, 1000)).toBe(1000);
  });

  it("patrol XP grows with the night", () => {
    expect(patrolXp(10)).toBeGreaterThan(patrolXp(1));
  });
});

describe("night clock", () => {
  it("attacks every day at 20h in Brasília (23h UTC)", () => {
    const from = new Date("2026-11-10T12:00:00Z");
    const to = new Date("2026-11-13T00:00:00Z");
    expect(nightTimesBetween(from, to).map((d) => d.toISOString())).toEqual([
      "2026-11-10T23:00:00.000Z",
      "2026-11-11T23:00:00.000Z",
      "2026-11-12T23:00:00.000Z",
    ]);
  });

  it("does not count the night it starts on and stops at `to`", () => {
    const at = new Date("2026-11-10T23:00:00Z");
    expect(nightTimesBetween(at, at)).toEqual([]);
    expect(nightTimesBetween(new Date("2026-11-10T23:30:00Z"), new Date("2026-11-11T22:59:00Z"))).toEqual([]);
    expect(nextNightTime(at).toISOString()).toBe("2026-11-11T23:00:00.000Z");
  });

  it("estimates how many nights the fire lasts", () => {
    expect(nightsFireLasts({ fromNight: 1, activeMembers: 20, defense: 1e9, fireHp: 600, fireMax: 600 })).toBeNull();
    expect(nightsFireLasts({ fromNight: 1, activeMembers: 20, defense: 0, fireHp: 600, fireMax: 600 })).toBe(4);
  });
});

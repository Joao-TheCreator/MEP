import { describe, expect, it } from "vitest";
import { GROUPS, simulateSeason, simulateSeasons } from "./balance";

/**
 * Balance targets for the horde season (design §15.5). If a number in config.ts
 * changes and one of these fails, look at `npm run balance` before changing the test.
 */
describe("season balance", () => {
  const s1 = Object.fromEntries(Object.entries(GROUPS).map(([k, mix]) => [k, simulateSeason(mix)]));

  it("the first week is safe: no group's fire drops below half in nights 1–7", () => {
    for (const r of Object.values(s1)) {
      for (const n of r.nights.slice(0, 7)) expect(n.fireHp).toBeGreaterThanOrEqual(n.fireMax / 2);
    }
  });

  it("a season lasts about three to five weeks", () => {
    for (const r of Object.values(s1)) {
      expect(r.wipedOnNight).not.toBeNull();
      expect(r.wipedOnNight!).toBeGreaterThanOrEqual(21);
      expect(r.wipedOnNight!).toBeLessThanOrEqual(35);
    }
  });

  it("playing more takes the group further", () => {
    expect(s1.dedicated.wipedOnNight!).toBeGreaterThan(s1.slow.wipedOnNight!);
    expect(s1.typical.wipedOnNight!).toBeGreaterThanOrEqual(s1.slow.wipedOnNight!);
    expect(s1.dedicated.wipedOnNight!).toBeGreaterThanOrEqual(s1.typical.wipedOnNight!);
  });

  it("the items kept after a wipe never make the next season shorter", () => {
    for (const mix of Object.values(GROUPS)) {
      const [a, b, c] = simulateSeasons(mix, 3);
      expect(b.wipedOnNight!).toBeGreaterThanOrEqual(a.wipedOnNight!);
      expect(c.wipedOnNight!).toBeGreaterThanOrEqual(b.wipedOnNight!);
    }
  });

  it("a mixed team never does worse than everyone shooting, and does better for the usual groups (§19)", () => {
    for (const [name, mix] of Object.entries(GROUPS)) {
      const shooters = simulateSeason(mix, { team: "shooters" }).wipedOnNight!;
      expect(s1[name].wipedOnNight!).toBeGreaterThanOrEqual(shooters);
    }
    for (const name of ["dedicated", "typical", "slow"] as const) {
      expect(s1[name].wipedOnNight!).toBeGreaterThan(simulateSeason(GROUPS[name], { team: "shooters" }).wipedOnNight!);
    }
  });

  it("the buildings last the season: nobody finishes them all in the first one, and groups that play more get further (§20)", () => {
    for (const r of Object.values(s1)) expect(r.farmLevel).toBeLessThan(9);
    expect(s1.dedicated.farmLevel).toBeGreaterThan(s1.slow.farmLevel);
    expect(s1.slow.farmLevel).toBeGreaterThanOrEqual(6);
  });

  it("the items kept after a wipe let a dedicated group finish the last building later on", () => {
    const seasons = simulateSeasons(GROUPS.dedicated, 3);
    expect(seasons[2].farmLevel).toBeGreaterThan(seasons[0].farmLevel);
  });

  it("is deterministic", () => {
    expect(simulateSeason(GROUPS.typical).nights).toEqual(s1.typical.nights);
  });
});

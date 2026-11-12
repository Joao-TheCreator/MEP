import { describe, expect, it } from "vitest";
import { surplusToSell } from "@/game/market";
import { nextStep, rewardPops, type HintInput, type Snapshot } from "./guide";

const calm: HintInput = {
  pending: 0, capacity: 480, resourceName: "Grãos", hour: 10, patrolled: true, hordeBeatsDefense: false,
  nightsFireLasts: null, freeAttributePoints: 0, talentToPick: false, gearReady: null,
  canUpgradeWorkshop: false, workshopName: "Arado", canDonateTo: null, taskReward: false, missingRole: null,
};

describe("next step hint", () => {
  it("says everything is fine when there is nothing to do", () => {
    expect(nextStep(calm)).toMatchObject({ tab: "farm" });
    expect(nextStep(calm).urgent).toBeFalsy();
  });

  it("a full storage comes first", () => {
    const h = nextStep({ ...calm, pending: 480, freeAttributePoints: 2, patrolled: false, nightsFireLasts: 1 });
    expect(h).toMatchObject({ tab: "work", urgent: true });
    expect(h.text).toContain("Grãos");
  });

  it("warns about the patrol when the fire dies tonight, and in the afternoon when the horde wins", () => {
    expect(nextStep({ ...calm, patrolled: false, nightsFireLasts: 1 })).toMatchObject({ tab: "night", urgent: true });
    expect(nextStep({ ...calm, patrolled: false, hordeBeatsDefense: true, hour: 14 })).toMatchObject({ tab: "night", urgent: true });
    // in the morning the same situation is not urgent yet
    expect(nextStep({ ...calm, patrolled: false, hordeBeatsDefense: true, hour: 9 }).urgent).toBeFalsy();
    // after the attack there is nothing to warn about
    expect(nextStep({ ...calm, patrolled: false, nightsFireLasts: 1, hour: 21 }).tab).toBe("farm");
  });

  it("then personal progress, in order: attributes, talent, gear, workshop, building", () => {
    const all = { ...calm, freeAttributePoints: 1, talentToPick: true, gearReady: "Arma", canUpgradeWorkshop: true, canDonateTo: "Poço" };
    expect(nextStep(all).text).toContain("1 ponto de atributo");
    expect(nextStep({ ...all, freeAttributePoints: 0 }).text).toContain("talento");
    expect(nextStep({ ...all, freeAttributePoints: 0, talentToPick: false }).text).toContain("Arma");
    expect(nextStep({ ...all, freeAttributePoints: 0, talentToPick: false, gearReady: null })).toMatchObject({ tab: "work" });
    expect(nextStep({ ...calm, canDonateTo: "Poço" })).toMatchObject({ tab: "farm" });
    expect(nextStep({ ...calm, freeAttributePoints: 3 }).text).toContain("3 pontos");
  });

  it("suggests switching class when a role is missing and the patrol is still to be done", () => {
    expect(nextStep({ ...calm, patrolled: false, missingRole: "tanque" })).toMatchObject({ tab: "hero" });
    expect(nextStep({ ...calm, patrolled: true, missingRole: "tanque" }).tab).toBe("farm");
  });

  it("a finished task comes before the personal progress", () => {
    expect(nextStep({ ...calm, taskReward: true, freeAttributePoints: 2 })).toMatchObject({ tab: "work" });
    expect(nextStep({ ...calm, taskReward: true }).text).toContain("Tarefa");
  });

  it("suggests collecting from half a storage and the patrol when idle", () => {
    expect(nextStep({ ...calm, pending: 240 })).toMatchObject({ tab: "work" });
    expect(nextStep({ ...calm, pending: 100, patrolled: false })).toMatchObject({ tab: "night" });
  });
});

describe("reward pops", () => {
  const base: Snapshot = { season: 1, coins: 10, level: 2, xpIntoLevel: 20, farmLevel: 1, inventory: { grain: 5 } };
  const names = { grain: "Grãos", plank: "Tábua" };

  it("shows nothing when nothing was gained", () => {
    expect(rewardPops(base, base, names)).toEqual([]);
    expect(rewardPops(base, { ...base, coins: 2, inventory: { grain: 1 } }, names)).toEqual([]);
  });

  it("shows coins, XP and the resources gained", () => {
    const pops = rewardPops(base, { ...base, coins: 60, xpIntoLevel: 44, inventory: { grain: 185, plank: 2 } }, names);
    expect(pops).toEqual([
      { text: "+24 XP" },
      { text: "+50", coin: true },
      { text: "+180 Grãos", resource: "grain" },
      { text: "+2 Tábua", resource: "plank" },
    ]);
  });

  it("a level up replaces the XP pop and is big", () => {
    const pops = rewardPops(base, { ...base, level: 3, xpIntoLevel: 4, farmLevel: 2 }, names);
    expect(pops).toEqual([{ text: "Sítio nível 2!", big: true }, { text: "Nível 3!", big: true }]);
  });

  it("stays quiet after a wipe", () => {
    expect(rewardPops(base, { ...base, season: 2, coins: 999 }, names)).toEqual([]);
  });
});

describe("surplus to sell", () => {
  it("keeps what the building and the workshop upgrade need", () => {
    expect(surplusToSell(500, [300, 100])).toBe(100);
    expect(surplusToSell(200, [300, 100])).toBe(0);
    expect(surplusToSell(50, [])).toBe(50);
  });
});

import { describe, expect, it } from "vitest";
import { BONUS_CAPS, LEVEL, MAX_ATTRIBUTE_POINTS, PROFESSION_KEYS, TALENTS, TIER_KEYS, TIERS } from "./config";
import {
  attributePointsEarned,
  bagPagesOpen,
  equipBest,
  gearSuggestions,
  itemValue,
  refineCost,
  type GearItem,
  attributesError,
  characterBonuses,
  craftExtraUnits,
  emptyAttributes,
  gearUpgradeCost,
  levelFromXp,
  talentTiersOpen,
  talentsError,
  totalXpForLevel,
  xpFor,
  xpToNext,
} from "./character";

describe("level & XP (design §11.1)", () => {
  it("each level costs 20% more XP", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(120);
    expect(xpToNext(10)).toBe(516);
    expect(xpToNext(LEVEL.maxLevel)).toBeNull();
  });

  it("converts total XP to level and progress", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 });
    expect(levelFromXp(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNext: 100 });
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 120 });
    expect(levelFromXp(totalXpForLevel(10) + 5).level).toBe(10);
    expect(levelFromXp(1e12)).toEqual({ level: LEVEL.maxLevel, xpIntoLevel: 0, xpForNext: null });
  });

  it("XP per action: donating is worth the most, sending nothing", () => {
    expect(xpFor("donate", 240)).toBe(240);
    expect(xpFor("craft", 10)).toBe(5);
    expect(xpFor("collect", 60)).toBe(6);
  });
});

describe("attributes (design §11.2)", () => {
  it("one point per level after the first", () => {
    expect(attributePointsEarned(1)).toBe(0);
    expect(attributePointsEarned(10)).toBe(9);
  });

  it("rejects overspending and values above the cap", () => {
    const a = { ...emptyAttributes(), strength: 5, spirit: 4 };
    expect(attributesError(a, 10)).toBeNull();
    expect(attributesError({ ...a, agility: 1 }, 10)).toBe("Pontos de atributo insuficientes.");
    expect(attributesError({ ...emptyAttributes(), strength: MAX_ATTRIBUTE_POINTS + 1 }, 30)).toMatch(/até 20/);
    expect(attributesError({ ...emptyAttributes(), strength: -1 }, 30)).toMatch(/inválida/);
  });
});

describe("talents (design §11.3)", () => {
  it("every profession has one tier per talent level, two choices each", () => {
    for (const p of PROFESSION_KEYS) {
      expect(TALENTS[p]).toHaveLength(LEVEL.talentLevels.length);
      for (const tier of TALENTS[p]) expect(tier).toHaveLength(2);
    }
  });

  it("tiers open at levels 5, 10, 15 and 20", () => {
    expect(talentTiersOpen(4)).toBe(0);
    expect(talentTiersOpen(5)).toBe(1);
    expect(talentTiersOpen(20)).toBe(4);
    expect(talentsError("farmer", [0, 1], 10)).toBeNull();
    expect(talentsError("farmer", [0, 1, 0], 10)).toBe("Esse talento abre no nível 15.");
    expect(talentsError("farmer", [0, null, 1], 15)).toBeNull();
  });
});

describe("gear tiers (design §12)", () => {
  it("goes Madeira → Bronze → Ferro → Prata → Ouro → Diamante → Brasa", () => {
    expect(TIER_KEYS.map((k) => TIERS[k].name)).toEqual(["Madeira", "Bronze", "Ferro", "Prata", "Ouro", "Diamante", "Brasa"]);
  });

  it("upgrade cost grows 1.9× per tier; Brasa is locked for now", () => {
    expect(gearUpgradeCost("wood")).toEqual({ plank: 10, iron_bar: 4, tool: 1 });
    expect(gearUpgradeCost("bronze")).toEqual({ plank: 19, iron_bar: 8, tool: 2 });
    expect(gearUpgradeCost("gold")).toEqual({ plank: 131, iron_bar: 53, tool: 14 });
    expect(gearUpgradeCost("diamond")).toBeNull();
    expect(gearUpgradeCost("ember")).toBeNull();
  });
});

describe("items, refine and slots (design §12)", () => {
  it("an item adds perPower × (tier power + refine × step) to its slot's bonus", () => {
    expect(itemValue({ slot: "tool", kind: "farmer", tier: "silver", refine: 4 })).toBe(13 + 4);
    expect(itemValue({ slot: "weapon", kind: "volley", tier: "bronze", refine: 2 })).toBe(4 + 4);
    expect(itemValue({ slot: "hat", tier: "gold", refine: 0 })).toBe(57);
    expect(itemValue({ slot: "hands", tier: "wood", refine: 4 })).toBe(1);
  });

  it("refine goes up to +10; cost grows with the level", () => {
    expect(refineCost(0)).toEqual({ iron_bar: 2, tool: 1 });
    expect(refineCost(5)).toEqual({ iron_bar: 12, tool: 3 });
    expect(refineCost(9)).toEqual({ iron_bar: 20, tool: 5 });
    expect(refineCost(10)).toBeNull();
  });

  it("backpack page III opens at level 15", () => {
    expect(bagPagesOpen(1)).toBe(2);
    expect(bagPagesOpen(15)).toBe(3);
  });
});

describe("gear suggestions", () => {
  const enxadaPrata: GearItem = { slot: "tool", kind: "farmer", tier: "silver", refine: 4 };
  const enxadaOuro: GearItem = { slot: "tool", kind: "farmer", tier: "gold", refine: 7 };
  const machado: GearItem = { slot: "tool", kind: "carpenter", tier: "diamond", refine: 10 };
  const broche: GearItem = { slot: "pin", tier: "bronze", refine: 0 };
  const chapeuRuim: GearItem = { slot: "hat", tier: "wood", refine: 0 };
  const chapeu: GearItem = { slot: "hat", tier: "iron", refine: 1 };

  it("points at the best item per slot, ignoring tools of other professions", () => {
    const bag = [machado, enxadaOuro, null, broche, chapeuRuim];
    const s = gearSuggestions({ tool: enxadaPrata, hat: chapeu }, bag, "farmer");
    expect(s).toEqual([
      { slot: "tool", bagIndex: 1, gain: 9 },
      { slot: "pin", bagIndex: 3, gain: 1.2 },
    ]);
  });

  it("equipBest swaps them and leaves the old ones in the backpack", () => {
    const r = equipBest({ tool: enxadaPrata }, [enxadaOuro, broche], "farmer");
    expect(r.loadout.tool).toBe(enxadaOuro);
    expect(r.loadout.pin).toBe(broche);
    expect(r.bag).toEqual([enxadaPrata, null]);
    expect(gearSuggestions(r.loadout, r.bag, "farmer")).toEqual([]);
  });
});

describe("characterBonuses", () => {
  const base = { profession: "farmer" as const, attributes: emptyAttributes(), talents: [], gear: {} };

  it("starts at zero", () => {
    expect(characterBonuses(base).productionPct).toBe(0);
  });

  it("adds attributes, talents and gear", () => {
    const b = characterBonuses({
      ...base,
      attributes: { ...emptyAttributes(), strength: 10, endurance: 5 },
      talents: [0, 1],
      gear: {
        tool: { slot: "tool", kind: "farmer", tier: "silver", refine: 0 },
        weapon: { slot: "weapon", kind: "volley", tier: "bronze", refine: 0 },
        hat: { slot: "hat", tier: "bronze", refine: 0 },
      },
    });
    expect(b.productionPct).toBe(15 + 8 + 13); // strength + Mão boa + Enxada de Prata
    expect(b.storageMinutes).toBe(60 + 12);    // endurance + Chapéu de Bronze
    expect(b.donationProgressPct).toBe(6);     // Primícias
    expect(b.damagePct).toBe(30 + 4);
  });

  it("a tool of another profession does nothing", () => {
    const b = characterBonuses({ ...base, gear: { tool: { slot: "tool", kind: "carpenter", tier: "diamond", refine: 10 } } });
    expect(b.productionPct).toBe(0);
  });

  it("is capped", () => {
    const maxed = { strength: 20, endurance: 20, agility: 20, craft: 20, spirit: 20 };
    const top = (slot: GearItem["slot"], kind?: GearItem["kind"]): GearItem => ({ slot, kind, tier: "diamond", refine: 10 });
    const gear = { tool: top("tool", "farmer"), weapon: top("weapon", "volley"), hat: top("hat"), body: top("body"),
      hands: top("hands"), feet: top("feet"), pin: top("pin"), bracelet: top("bracelet") };
    const b = characterBonuses({ ...base, attributes: maxed, talents: [0, 0, 0, 0], gear });
    for (const k of Object.keys(BONUS_CAPS) as (keyof typeof BONUS_CAPS)[]) expect(b[k]).toBeLessThanOrEqual(BONUS_CAPS[k]);
    expect(b.productionPct).toBe(BONUS_CAPS.productionPct);
  });
});

describe("craftExtraUnits", () => {
  it("gives the expected value; one roll decides the fraction", () => {
    expect(craftExtraUnits(100, 6, 0.99)).toBe(6);
    expect(craftExtraUnits(10, 6, 0.5)).toBe(1); // 0.6 expected, roll 0.5 < 0.6
    expect(craftExtraUnits(10, 6, 0.7)).toBe(0);
    expect(craftExtraUnits(5, 0, 0)).toBe(0);
  });
});

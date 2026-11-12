import { describe, expect, it } from "vitest";
import { GEAR, MARKET, RECIPES, RECIPE_KEYS, RESOURCE_KEYS } from "./config";
import { bagBuyCost, bagSellValue, buyCost, buyPoints, dailyBuyLimit, gameDay, maxBuyable, sellValue } from "./market";
import { recipeInputs } from "./rules";

describe("Vendinha (design §16)", () => {
  it("sells at 50% and buys at 200% of the point value", () => {
    expect(sellValue("plank", 10)).toBe(20); // 4 pts × 10 × 50%
    expect(buyCost("plank", 10)).toBe(80); // 4 pts × 10 × 200%
    expect(sellValue("grain", 1)).toBe(0); // rounds down on the total
    expect(sellValue("grain", 3)).toBe(1);
    expect(buyCost("grain", 1)).toBe(2);
  });

  it("buying always costs at least 4× what selling pays (trading with a friend stays better)", () => {
    expect(MARKET.buyPct / MARKET.sellPct).toBeGreaterThanOrEqual(4);
    for (const r of RESOURCE_KEYS) expect(buyCost(r, 20)).toBeGreaterThanOrEqual(4 * sellValue(r, 20));
  });

  it("no infinite money: buying inputs, crafting and selling always loses coins", () => {
    for (const k of RECIPE_KEYS) {
      for (const times of [1, 7, 100]) {
        expect(sellValue(RECIPES[k].output, times)).toBeLessThan(bagBuyCost(recipeInputs(k, times)));
      }
    }
  });

  it("a solo level-1 player can buy one Bronze upgrade a day, and not much more", () => {
    // A level-1 farmer makes 60 points/hour: a full 8 h storage sells for 240 coins.
    const fullStorage = sellValue("grain", 480);
    expect(fullStorage).toBe(240);
    const bronze = bagBuyCost(GEAR.baseUpgradeCost);
    expect(bronze).toBe(218);
    expect(bronze).toBeGreaterThan(fullStorage / 2);
    // the daily limit (165 points at level 1) fits one Bronze (109 points) but not two
    const bronzePoints = 10 * 4 + 4 * 10 + 1 * 29;
    expect(dailyBuyLimit(1)).toBeGreaterThanOrEqual(bronzePoints);
    expect(dailyBuyLimit(1)).toBeLessThan(2 * bronzePoints);
  });

  it("daily limit grows with the level", () => {
    expect(dailyBuyLimit(1)).toBe(165);
    expect(dailyBuyLimit(10)).toBe(300);
    expect(buyPoints("tool", 2)).toBe(58);
  });

  it("maxBuyable respects both coins and the limit left", () => {
    expect(maxBuyable("plank", 80, 1000)).toBe(10); // coins bind: 10 planks cost 80
    expect(maxBuyable("plank", 1000, 20)).toBe(5); // limit binds: 5 planks = 20 points
    expect(maxBuyable("tool", 57, 1000)).toBe(0); // one tool costs 58
    expect(maxBuyable("plank", 0, 1000)).toBe(0);
    for (const coins of [1, 13, 99, 250]) {
      for (const r of RESOURCE_KEYS) expect(buyCost(r, maxBuyable(r, coins, 1e9))).toBeLessThanOrEqual(coins);
    }
  });

  it("bag helpers add up", () => {
    expect(bagSellValue({ plank: 10, cheese: 2 })).toBe(20 + 10);
  });

  it("the game day turns at midnight in Brasília", () => {
    expect(gameDay(new Date("2026-11-13T02:59:00Z"))).toBe("2026-11-12");
    expect(gameDay(new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-13");
  });
});

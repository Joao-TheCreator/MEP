/**
 * Coins and the Vendinha (design §16). Pure functions; numbers in MARKET (./config).
 * Buying costs buyPct/sellPct times what selling pays (4×), so trading with a
 * friend (free, 1 for 1) is always better; the shop only keeps nobody stuck.
 */
import { MARKET, RESOURCES, type Bag, type ResourceKey } from "./config";

/** Coins received for selling `qty` of a resource (rounded down on the total). */
export function sellValue(resource: ResourceKey, qty: number): number {
  return Math.floor((RESOURCES[resource].points * qty * MARKET.sellPct) / 100);
}

/** Coins paid for buying `qty` of a resource (rounded up on the total). */
export function buyCost(resource: ResourceKey, qty: number): number {
  return Math.ceil((RESOURCES[resource].points * qty * MARKET.buyPct) / 100);
}

/** Points of value a purchase uses from the daily limit. */
export function buyPoints(resource: ResourceKey, qty: number): number {
  return RESOURCES[resource].points * qty;
}

/** Daily purchase limit (points of value) at this character level. */
export function dailyBuyLimit(level: number): number {
  return MARKET.dailyBuyBase + MARKET.dailyBuyPerLevel * Math.max(1, level);
}

/** Most units of `resource` the player can buy now, given coins and what is left of today's limit. */
export function maxBuyable(resource: ResourceKey, coins: number, limitLeft: number): number {
  const p = RESOURCES[resource].points;
  const byLimit = Math.floor(Math.max(0, limitLeft) / p);
  let byCoins = Math.floor((Math.max(0, coins) * 100) / (p * MARKET.buyPct));
  while (byCoins > 0 && buyCost(resource, byCoins) > coins) byCoins--;
  return Math.min(byLimit, byCoins);
}

/** Coins for selling a whole bag. */
export function bagSellValue(bag: Bag): number {
  return (Object.entries(bag) as [ResourceKey, number][]).reduce((s, [r, q]) => s + sellValue(r, q), 0);
}

/** Coins for buying a whole bag. */
export function bagBuyCost(bag: Bag): number {
  return (Object.entries(bag) as [ResourceKey, number][]).reduce((s, [r, q]) => s + buyCost(r, q), 0);
}

/** The game day (YYYY-MM-DD) in Brasília (UTC−3), for daily limits. */
export function gameDay(now: Date): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

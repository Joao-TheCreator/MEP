import type { SpriteDef } from "@/art/pixel";
import { C } from "@/art/palette";

/**
 * Original sprites used only by the announcement trailer (/trailer):
 * gear icons recolored per tier and an unlit / extinguished campfire.
 */

export interface Tier {
  name: string;
  /** base, light, dark */
  b: string;
  l: string;
  d: string;
}

export const TIERS: Tier[] = [
  { name: "Bronze", b: "#c8843f", l: "#ecb676", d: "#8a5528" },
  { name: "Ferro", b: C.iron, l: C.ironLight, d: C.ironDark },
  { name: "Ouro", b: C.gold, l: "#f8e39a", d: C.goldDark },
  { name: "Diamante", b: "#6fd6e8", l: "#dcf9fd", d: "#3a9fb8" },
];

const SWORD_ROWS = [
  ".............lll",
  "............lbbl",
  "...........lbbd.",
  "..........lbbd..",
  ".........lbbd...",
  "........lbbd....",
  ".......lbbd.....",
  "..G...lbbd......",
  "..GG.lbbd.......",
  "...GGlbd........",
  "....GGd.........",
  "....hGGG........",
  "...hhh.GG.......",
  "..hhh....G......",
  ".obh............",
  ".oo.............",
];

const ARMOR_ROWS = [
  ".dd........dd.",
  "dbld......dlbd",
  "dbllddddddllbd",
  "dblbbbbbbbbbbd",
  ".dbbblbbkbbbd.",
  ".dbblbbkkkbbd.",
  ".dbbbbbkkbbbd.",
  ".dbbbbbbbbbbd.",
  ".dddddddddddd.",
  ".dbbbbbbbbbbd.",
  ".dbllbbbbbbbd.",
  "..dbbbbbbbbd..",
  "...dddddddd...",
];

export function swordSprite(t: Tier): SpriteDef {
  return { rows: SWORD_ROWS, colors: { b: t.b, l: t.l, d: t.d, G: t.d, h: C.woodDark, o: t.b } };
}

export function armorSprite(t: Tier): SpriteDef {
  return { rows: ARMOR_ROWS, colors: { b: t.b, l: t.l, d: t.d, k: C.flame } };
}

export const SWORDS = TIERS.map(swordSprite);
export const ARMORS = TIERS.map(armorSprite);

/** Campfire logs with no flame (before lighting / after it goes out). */
export const FIRE_LOGS: SpriteDef = {
  colors: { c: "#3a2a26", e: "#7a3a2a", t: C.trunk, T: C.trunkDark, s: C.stoneDark },
  rows: [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "....ceccec....",
    "...cceeccc....",
    "..tTttTTttTt..",
    ".tTTtttttTTTt.",
    "..ssss..ssss..",
  ],
};

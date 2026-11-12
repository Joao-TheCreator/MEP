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

// ---- v2 (phase 8–9): the five night classes and the new systems ----
// Same pixels as src/prototype/night/sprites.ts (copied: the trailer branch is older).

/** Guitar held by the "Violão" class. */
export const GUITAR: SpriteDef = {
  colors: { n: "#5a3a22", h: "#3a2414", b: "#c98a45", l: "#e3a861", o: "#2a1a10", s: "#f3e3c0" },
  rows: ["..hh..", "..nn..", "..ns..", "..ns..", ".bnsb.", "blloll", "bbooob", "blllbb", ".bbbb."],
};

/** Ladle held by the "Cozinheira" class. */
export const LADLE: SpriteDef = {
  colors: { h: "#8a5a32", m: "#c7ccd6", d: "#8d94a3", s: "#f3d27a" },
  rows: ["..h..", "..h..", "..h..", "..h..", "mm.mm", "msssm", "dmmmd", ".ddd."],
};

/** Lantern held by the "Lanterna" class. */
export const LANTERN: SpriteDef = {
  colors: { k: "#3b3b4a", y: "#ffe08a", w: "#fff6d0", o: "#f2a03d" },
  rows: [".kk.", "k..k", "kkkk", "kywk", "kyyk", "kook", "kkkk"],
};

/** Music note (Violão's shot and "Acorde"). */
export const NOTE: SpriteDef = {
  colors: { n: "#ffd6f0", p: "#f08ac8" },
  rows: ["..pp", "..pn", "..p.", "..p.", "ppp.", "pnp.", ".p.."],
};

/** Coin. */
export const COIN_T: SpriteDef = {
  colors: { o: C.goldDark, g: C.gold, l: "#f8e39a" },
  rows: [".oooo.", "oggggo", "oglggo", "oglggo", "oggggo", ".oooo."],
};

/** Small heart (Marmita heal). */
export const HEART: SpriteDef = {
  colors: { r: "#8fe07a", l: "#d4f7c4" },
  rows: [".r.r.", "rlrrr", "rrrrr", ".rrr.", "..r.."],
};

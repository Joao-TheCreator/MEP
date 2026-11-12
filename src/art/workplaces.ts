import type { SpriteDef } from "./pixel";
import { C } from "./palette";
import { CAMPFIRE } from "@/prototype/night/sprites";

/**
 * Work places of the four professions and the campfire, drawn on the farm map
 * (roadmap 1b, "sítio vivo"). Original sprites, soft shapes, no hard outlines.
 */

/** Pads every row with transparent pixels to the widest row. */
function sprite(colors: Record<string, string>, rows: string[]): SpriteDef {
  const w = Math.max(...rows.map((r) => r.length));
  return { colors, rows: rows.map((r) => r.padEnd(w, ".")) };
}

/** Lavoura (Agricultor): rows of sprouts and ripe grain. */
export const CROPS = sprite(
  { d: C.dirt, s: C.dirtDark, g: C.leaf, G: C.leafLight, y: "#e8c15a" },
  [
    "dddddddddddddddd",
    "dyGdyGdyGdyGdyGd",
    "dgGdgGdgGdgGdgGd",
    "ssssssssssssssss",
    "dGgdGgdGgdGgdGgd",
    "dgGdgGdgGdgGdgGd",
    "ssssssssssssssss",
    "dyGdyGdyGdyGdyGd",
    "dgGdgGdgGdgGdgGd",
    "dddddddddddddddd",
  ],
);

/** Curral (Pecuarista): a fenced pen with a cow. */
export const PEN = sprite(
  { p: C.trunkDark, r: C.trunk, w: "#f3ecdc", k: "#4a3a3a", n: "#e9a0a0" },
  [
    "p..p..p..p..p..p..p..p",
    "rrrrrrrrrrrrrrrrrrrrrr",
    "p....................p",
    "p.....wwkww..........p",
    "p....wwwwkwww........p",
    "p...nwkwwwwwww.......p",
    "p....wwwkkwww........p",
    "p....w.w..w.w........p",
    "p....................p",
    "rrrrrrrrrrrrrrrrrrrrrr",
    "p..p..p..p..p..p..p..p",
  ],
);

/** Serraria (Carpinteiro): a pile of logs and a sawhorse with a plank. */
export const SAWMILL = sprite(
  { o: C.trunkDark, O: "#c9a070", l: "#e3c08a", L: "#c49a5e", t: C.trunk },
  [
    ".........llllllllll",
    ".........LLLLLLLLLL",
    "..........t......t.",
    "..oo......t......t.",
    ".oOOo.oo.tt.....tt.",
    ".oOOooOOo.t.t...t.t",
    "oOOooOOOOo.........",
    "oOOooOOOOo.........",
    ".oooooooo..........",
  ],
);

/** Forja (Ferreiro): a stone furnace with the fire lit and an anvil. */
export const FORGE = sprite(
  { s: C.stone, S: C.stoneDark, k: "#3a2a2a", f: C.ember, y: "#ffe08a", a: "#6f6a61", A: "#8d887d" },
  [
    "...SS.........",
    "...SS.........",
    "..ssss........",
    ".ssssss.......",
    "ssssssss......",
    "sskkkkss......",
    "skyffyks.AAAAA",
    "skfyyfks..aaa.",
    "ssssssss..aaa.",
    "SSSSSSSS.aaaaa",
  ],
);

/** Campfire on the map: the two burning frames, and a weaker flame when the fire is low. */
export const MAP_FIRE: SpriteDef[] = CAMPFIRE;
export const MAP_FIRE_LOW: SpriteDef[] = CAMPFIRE.map((f) => ({
  colors: f.colors,
  rows: f.rows.map((r, i) => (i < 3 ? ".".repeat(r.length) : r)),
}));

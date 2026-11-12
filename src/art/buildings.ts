import type { SpriteDef } from "./pixel";
import { C } from "./palette";

/**
 * The later community buildings (design §20): Vendinha, Cerca, Torre de vigia,
 * Cozinha and Forja comunitária. Original sprites, soft shapes.
 */

function sprite(colors: Record<string, string>, rows: string[]): SpriteDef {
  const w = Math.max(...rows.map((r) => r.length));
  return { colors, rows: rows.map((r) => r.padEnd(w, ".")) };
}

/** Vendinha: a market stall with a striped awning and goods on the counter. */
export const SHOP = sprite(
  { r: C.flame, w: C.arch, p: C.trunkDark, k: "#4a3a3a", g: "#e8c15a", G: C.leafLight, c: "#c49a5e", C: C.trunk },
  [
    ".rrwwrrwwrrwwrr.",
    "rrwwrrwwrrwwrrww",
    "rwwrrwwrrwwrrwwr",
    ".r.w.r.w.r.w.r..",
    ".p............p.",
    ".pkkkkkkkkkkkkp.",
    ".pkgkkGkkgkkGkp.",
    ".pkkkkkkkkkkkkp.",
    ".cccccccccccccc.",
    ".cCcCcCcCcCcCcC.",
    ".cccccccccccccc.",
    ".CCCCCCCCCCCCCC.",
  ],
);

/** Cerca: a stretch of wooden fence south of the camp. */
export const FENCE = sprite(
  { p: C.trunkDark, r: C.trunk },
  [
    "p....p....p....p....p....p....p....p",
    "p....p....p....p....p....p....p....p",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "p....p....p....p....p....p....p....p",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "p....p....p....p....p....p....p....p",
  ],
);

/** Torre de vigia: a wooden lookout with a lantern under a small roof. */
export const TOWER = sprite(
  { r: "#d9773a", R: "#b85c28", p: C.trunkDark, w: "#c49a5e", W: C.trunk, y: "#ffe08a" },
  [
    "...rrrr...",
    "..rrrrrr..",
    ".RRRRRRRR.",
    ".p.yy...p.",
    ".p.yy...p.",
    ".p......p.",
    "wwwwwwwwww",
    "WWWWWWWWWW",
    "..p....p..",
    "..pp..pp..",
    "..p.pp.p..",
    "..p.pp.p..",
    "..pp..pp..",
    "..p....p..",
    "..pp..pp..",
    "..p.pp.p..",
    "..p.pp.p..",
    "..pp..pp..",
    ".pp....pp.",
    ".p......p.",
  ],
);

/** Cozinha: a small brick kitchen with a smoking chimney and lit windows. */
export const KITCHEN = sprite(
  { s: "#d8d2c4", c: C.brickDark, o: "#e58a45", O: "#c26a30", b: C.brickLight, B: C.brickDark, w: "#ffe08a", d: C.trunkDark },
  [
    "..........ss....",
    "...........s....",
    "..........cc....",
    "...oooooooccoo..",
    "..oooooooooooo..",
    ".oooooooooooooo.",
    "OOOOOOOOOOOOOOOO",
    ".bbbbbbbbbbbbbb.",
    ".bwwbbbddbbwwbb.",
    ".bwwbbbddbbwwbb.",
    ".bbbbbbddbbbbbb.",
    ".BBBBBBBBBBBBBB.",
  ],
);

/** Forja comunitária: a big stone smithy with the fire glowing and an anvil. */
export const SMITHY = sprite(
  { S: C.stoneDark, R: C.roofDark, s: C.stone, k: "#3a2a2a", f: C.ember, y: "#ffe08a", a: "#6f6a61" },
  [
    "....SS..........",
    "....SS..........",
    "..RRRRRRRRRRRR..",
    ".RRRRRRRRRRRRRR.",
    "RRRRRRRRRRRRRRRR",
    ".ssssssssssssss.",
    ".sskkkkkkssssss.",
    ".skyffyyksaaaas.",
    ".skfyyffkssaass.",
    ".skkkkkkksaaaas.",
    ".ssssssssssssss.",
    ".SSSSSSSSSSSSSS.",
  ],
);

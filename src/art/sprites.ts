import { C } from "./palette";
import { Grid } from "./grid";
import type { SpriteDef } from "./pixel";

// ---------------------------------------------------------------- logo
/** Pixel version of the church logo: flame (red + pink + ember) over a hand. */
export const LOGO: SpriteDef = {
  colors: { f: C.flame, F: "#c93d3d", p: C.flameLight, e: C.ember, w: C.wine },
  rows: [
    "............f.......",
    "...........ff.......",
    "..........fff.......",
    ".........ffff.......",
    "........fffff.......",
    "......ffffff........",
    "....fffffffff.......",
    "...ffffffffff.......",
    "..fffffffffff...p...",
    "..ffffffffffff.pp...",
    ".fffffffffffff.ppp..",
    ".ffffffffffff.pppp..",
    ".fffffffffff.ppppp..",
    ".Fffffffffff.ppppp..",
    "..Fffffffff.epppp...",
    "w..FFfffff.eeppp..ww",
    "ww..FFff.........ww.",
    ".www............www.",
    "..wwwwwwwwwwwwwwww..",
    "....wwwwwwwwwwww....",
  ],
};

// ---------------------------------------------------------------- resources
const RES_COLORS = {
  y: C.gold, Y: C.goldDark, g: C.leafLight, G: C.leaf,
  m: C.milk, s: C.milkShade, k: C.flame, r: C.wine,
  w: C.wood, W: C.woodLight, d: C.woodDark, o: C.dirt, O: C.dirtDark,
  i: C.iron, I: C.ironDark, l: C.ironLight,
  c: C.cheese, h: C.cheeseDark,
  n: C.stone, N: C.stoneDark, x: C.corn,
};

export const RESOURCE_SPRITES: Record<string, SpriteDef> = {
  grain: {
    colors: RES_COLORS,
    rows: [
      ".....y......",
      "..y.yYy.y...",
      ".yYyyYyyYy..",
      "..yYyyYyY...",
      ".yYyYyyYyy..",
      "..yyyYyYy...",
      "...yYyYy....",
      "....GgG.....",
      "....YyY.....",
      "....GgG.....",
      "...G.g.G....",
      "..G..g..G...",
    ],
  },
  milk: {
    colors: RES_COLORS,
    rows: [
      "....kkkk....",
      "....kkkk....",
      ".....ms.....",
      "....mmms....",
      "...mmmmms...",
      "...mmmmms...",
      "...rrrrrr...",
      "...rmmmrr...",
      "...rrrrrr...",
      "...mmmmms...",
      "...mmmmms...",
      "....ssss....",
    ],
  },
  wood: {
    colors: RES_COLORS,
    rows: [
      "............",
      "............",
      ".dddddddooo.",
      "dwwwwwwwoOOo",
      "dWWWWWWWoOoO",
      "dwwwwwwwoOOo",
      ".dddddddooo.",
      "..dddddddooo",
      ".dwwwwwwwoOO",
      ".dWWWWWWWoOo",
      ".dwwwwwwwoOO",
      "..ddddddd...",
    ],
  },
  ore: {
    colors: RES_COLORS,
    rows: [
      "............",
      "............",
      ".....nn.....",
      "....nnnNN...",
      "...nnlnnNN..",
      "..nnnnnnINN.",
      "..nnnilnnNN.",
      ".nnnnnnnnNNN",
      ".nnlnnnnInNN",
      ".NnnnnnnnNNN",
      "..NNNNNNNNN.",
      "............",
    ],
  },
  feed: {
    colors: RES_COLORS,
    rows: [
      "....x.x.....",
      "...xYxYx....",
      "....YxY.....",
      "...ooOoo....",
      "..oooOooo...",
      ".ooooooooo..",
      ".oooxxxooO..",
      ".ooxxYxxoO..",
      ".oooxxxooO..",
      ".ooooooooO..",
      "..oooooOO...",
      "............",
    ],
  },
  cheese: {
    colors: RES_COLORS,
    rows: [
      "............",
      "............",
      "........cc..",
      "......ccccc.",
      "....ccccccc.",
      "..cccccccchh",
      "cccccccchhhh",
      "chhchhhhhhhh",
      "chhhhhchhhhh",
      "chhhhhhhhchh",
      "chchhhhhhhhh",
      "hhhhhhhhhhh.",
    ],
  },
  plank: {
    colors: RES_COLORS,
    rows: [
      "............",
      "............",
      "............",
      "WWWWWWWWWWWw",
      "wwwwdwwwwwwd",
      "dddddddddddd",
      "............",
      "WWWWWWWWWWWw",
      "wwwwwwwdwwwd",
      "dddddddddddd",
      "............",
      "............",
    ],
  },
  iron_bar: {
    colors: RES_COLORS,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "...llllll...",
      "..lllllliI..",
      ".liiiiiiiII.",
      "iiiiiiiiiIII",
      "IIIIIIIIIIII",
      "............",
      "............",
      "............",
    ],
  },
  tool: {
    colors: RES_COLORS,
    rows: [
      "............",
      ".lliii......",
      ".liiiiI.....",
      "..IIiiII....",
      "...I.dWd....",
      "......dWd...",
      ".......dWd..",
      "........dWd.",
      ".........dWd",
      "..........dd",
      "............",
      "............",
    ],
  },
};

// ---------------------------------------------------------------- nature
const NAT = {
  l: C.leaf, L: C.leafLight, d: C.leafDark, D: C.leafDeep,
  t: C.trunk, T: C.trunkDark, s: "#00000022",
};

export const TREE: SpriteDef = {
  colors: NAT,
  rows: [
    "....LLll....",
    "..LLLlllld..",
    ".LLlllllldd.",
    ".Llllllldld.",
    "Lllllllldddd",
    "llllldlllddd",
    "llldllllddDd",
    ".lllllldddD.",
    ".dlldldddDD.",
    "..ddddDDDD..",
    "....DtTD....",
    ".....tT.....",
    "...sstTss...",
  ],
};

export const TREE_DARK: SpriteDef = {
  colors: { ...NAT, l: C.leafDark, L: C.leaf, d: C.leafDeep, D: "#1d3f1f" },
  rows: TREE.rows,
};

export const PALM: SpriteDef = {
  colors: NAT,
  rows: [
    "...L....L....",
    "..LlL..LlL...",
    ".Ll.lLLl.lL..",
    "L....lll....L",
    "...LlldllL...",
    "..Ll.ldl.lL..",
    ".L...ddd...L.",
    "......t......",
    "......T......",
    "......t......",
    "......T......",
    ".....tT......",
    ".....sTs.....",
  ],
};

// ---------------------------------------------------------------- temple
/** Templo Dae Han: brick walls, white arches/columns, long grey hipped roof. */
export function templeSprite(W = 56): SpriteDef {
  const g = new Grid(W, 30);
  // roof (hip): ridge at top, slopes 1px per row
  for (let y = 0; y <= 10; y++) {
    const x0 = 10 - y;
    const x1 = W - 11 + y;
    for (let x = x0; x <= x1; x++) {
      let ch = "R";
      if (x < 10 || x > W - 11) ch = "q"; // hip end faces (shade)
      else if ((x - 10) % 3 === 2) ch = "r"; // corrugation
      if (y === 0) ch = "L";
      if (y === 10) ch = "r";
      g.set(x, y, ch);
    }
  }
  g.rect(1, 11, W - 2, 1, "a"); // fascia
  g.rect(2, 12, W - 4, 1, "A");
  // brick wall with soft texture
  for (let y = 13; y <= 26; y++) {
    for (let x = 2; x < W - 2; x++) {
      const mortar = (y % 3 === 0 && (x + y) % 2 === 0) || ((x + (y % 6 < 3 ? 0 : 2)) % 4 === 0 && y % 3 === 1);
      g.set(x, y, mortar ? "B" : (x * 7 + y * 3) % 11 === 0 ? "c" : "b");
    }
  }
  // columns + arched bays
  const bays: number[] = [];
  for (let bx = 3; bx <= W - 8; bx += 9) bays.push(bx);
  for (const bx of bays) {
    g.rect(bx - 1, 13, 1, 14, "a");
    g.rect(bx, 13, 1, 14, "A");
  }
  g.rect(W - 4, 13, 1, 14, "a");
  bays.slice(0, -1).forEach((bx, i) => {
    const cx = bx + 3; // arch left
    const door = i === Math.floor((bays.length - 1) / 2);
    g.stamp(cx, 15, [".aaa.", "aWWWa"]);
    const bottom = door ? 26 : 23;
    for (let y = 17; y <= bottom; y++) g.stamp(cx, y, [door ? "aDDDa" : "aWwWa"]);
    if (!door) g.stamp(cx, 24, ["AaaaA"]);
  });
  g.rect(0, 27, W, 1, "S");
  g.rect(0, 28, W, 2, "s");
  return {
    rows: g.rows(),
    colors: {
      R: C.roof, r: C.roofDark, q: C.roofDark, L: C.roofLight,
      a: C.arch, A: C.archShade,
      b: C.brick, B: C.brickDark, c: C.brickLight,
      W: C.window, w: "#5d4a49", D: C.wineDark,
      S: C.stone, s: C.stoneDark,
    },
  };
}

export const POOL: SpriteDef = {
  colors: { i: C.ironLight, I: C.iron, S: C.stone, s: C.stoneDark, w: C.water, l: C.waterLight, d: C.waterDark },
  rows: [
    "IiIiIiIiIiIiIiIiIiIi",
    "iSSSSSSSSSSSSSSSSSSi",
    "ISddddddddddddddddSI",
    "iSdwwwwwwwwwwwwwwdSi",
    "ISdwlwwwwwwwwlwwwdSI",
    "iSdwwllwwwwwwwwwwdSi",
    "ISdwwwwwwwwlwwwwwdSI",
    "iSdwwwwwwwwwllwwwdSi",
    "ISdwwwlwwwwwwwwwwdSI",
    "iSdwwwwllwwwwwwlwdSi",
    "ISdwwwwwwwwwwwwwwdSI",
    "iSSSSSSSSSSSSSSSSSSi",
    "IsssssssssssssssssI.",
    "IiIiIiIiIiIiIiIiIiIi",
  ],
};

export const HOUSE: SpriteDef = {
  colors: { t: C.tile, T: C.tileDark, a: C.arch, A: C.archShade, W: C.window, d: C.woodDark },
  rows: [
    "......tt......",
    "....tttttT....",
    "..ttttttttTT..",
    "ttttttttttTTTT",
    "TTTTTTTTTTTTTT",
    ".aaaaaaaaaaaA.",
    ".aWWaaaaaWWaA.",
    ".aWWaaddaWWaA.",
    ".aaaaaddaaaaA.",
    ".AAAAAddAAAAA.",
  ],
};

// ---------------------------------------------------------------- community buildings
export const WELL: SpriteDef = {
  colors: { d: C.woodDark, w: C.wood, W: C.woodLight, r: C.tile, R: C.tileDark, n: C.stone, N: C.stoneDark, b: C.waterDark, k: C.flame },
  rows: [
    "...rrrrrR...",
    "..rrrrrrRR..",
    ".rrrrrrrRRR.",
    "..d.....d...",
    "..d..k..d...",
    "..d..W..d...",
    "..d..w..d...",
    ".nnnnnnnnN..",
    "nnNbbbbbNnN.",
    "nNnnnnnnnNN.",
    "nnnNnnnNnNN.",
    ".NNNNNNNNN..",
  ],
};

export const BARN: SpriteDef = {
  colors: { r: C.flame, R: C.wine, p: C.flameLight, a: C.arch, A: C.archShade, W: C.window, g: C.roofDark, G: C.roof, d: C.woodDark, y: C.gold },
  rows: [
    ".......GGGG.......",
    ".....GGGGGGgg.....",
    "...GGGGGGGGGggg...",
    ".GGGGGGGGGGGGgggg.",
    "gggggggggggggggggg",
    ".rrrrrrraaarrrrrR.",
    ".rprrrrraWarrrrrR.",
    ".rrrrrrraaarrrrrR.",
    ".rrrraaaaaaaaarrR.",
    ".rprraRdddddRarrR.",
    ".rrrraddRRddaarrR.",
    ".rrrradRyyRdaarrR.",
    ".rprradRyyRdaarrR.",
    ".RRRRaddddddaaRRR.",
  ],
};

export const MILL: SpriteDef = {
  colors: { w: C.arch, W: C.archShade, b: C.brick, B: C.brickDark, c: C.brickLight, d: C.woodDark, D: C.wood, r: C.roofDark, R: C.roof, k: C.flame },
  rows: [
    "D.......D.......",
    ".D.....D........",
    "..D...D.........",
    "...D.D..........",
    "....k...........",
    "...D.D..........",
    "..D.rRR.........",
    ".D.rRRRR........",
    "D..rRRRR........",
    "...bbbbbB.......",
    "...bbbbbB.......",
    "...bbdbbB.......",
    "...bbdbbB.......",
    "..bbbdbbbB......",
    "..BBBBBBBB......",
  ],
};

export const CONSTRUCTION: SpriteDef = {
  colors: { d: C.woodDark, w: C.wood, o: C.dirt, O: C.dirtDark, k: C.flame, y: C.gold },
  rows: [
    "....k.......",
    "....kk......",
    "....d.......",
    "..dwdwdwd...",
    "..d.d.d.d...",
    "..dwdwdwd...",
    "..d.d.d.d...",
    ".oooooooooo.",
    "ooOoooyoOooo",
    ".OOOOOOOOOO.",
  ],
};

import type { SpriteDef } from "@/art/pixel";
import { C } from "@/art/palette";

/** Night creatures and props for the night prototype (issue #14). Soft, no hard outlines. */

const SHADOW = { a: "#160f26", b: "#251a3d", c: "#382a58", e: "#f4e27a" };

export const SOMBRA: SpriteDef = {
  colors: SHADOW,
  rows: [
    "....bbbbbb....",
    "..bbccccccbb..",
    ".bccccccccccb.",
    ".bccbbccbbccb.",
    "bbcbeebbeebcbb",
    "bbcbeebbeebcbb",
    "bbccbbbbbbccbb",
    "bbbccccccccbbb",
    "bbbbccccccbbbb",
    ".bbbbbbbbbbbb.",
    ".bbabbbbbbabb.",
    "..ba.bbbb.ab..",
    "..a..baab..a..",
    ".....a..a.....",
  ],
};

export const VULTO: SpriteDef = {
  colors: { a: "#120c1f", b: "#22183a", r: "#ff5a5a" },
  rows: [
    "...aaaa...",
    "..abbbba..",
    ".abbbbbba.",
    ".abrbbrba.",
    ".abbbbbba.",
    "..abbbba..",
    "..abbbba..",
    ".aabbbbaa.",
    "aabbbbbbaa",
    "a.abbbba.a",
    "..abbbba..",
    "..abbbba..",
    "..ab..ba..",
    ".ab....ba.",
    ".a......a.",
  ],
};

export const ASSOMBRACAO: SpriteDef = {
  colors: { w: "#d9cdf0", s: "#a996d4", h: "#4e3f6e" },
  rows: [
    "....wwwwww....",
    "..wwwwwwwwww..",
    ".wwwwwwwwwwww.",
    ".wwhhwwwwhhww.",
    "wwwhhwwwwhhwww",
    "wwwwwwwwwwwwww",
    "wwwwwhhhhwwwww",
    "wwwwwhhhhwwwww",
    "swwwwwwwwwwwws",
    "sswwwwwwwwwwss",
    "ssswwwwwwwwsss",
    "sssswwsswwssss",
    ".ss.ssssss.ss.",
    ".s...ss.ss..s.",
    "......s..s....",
  ],
};

export const VOLLEYBALL: SpriteDef = {
  colors: { y: "#f6e9b0", w: "#ffffff", b: "#4f8ad6" },
  rows: ["..yy..", ".ywby.", "ywwbby", "ybbwwy", ".ybwy.", "..yy.."],
};

export const SPIKE_BALL: SpriteDef = {
  colors: { y: "#ffe08a", w: "#ffffff", b: "#f0566a" },
  rows: ["..yy..", ".ywby.", "ywwbby", "ybbwwy", ".ybwy.", "..yy.."],
};

export const ORB: SpriteDef = {
  colors: { p: "#b07cf0", l: "#efe2ff" },
  rows: [".ppp.", "pplpp", "plllp", "pplpp", ".ppp."],
};

/** Mattress held by the "Colchonete" class (vertical, like a shield). */
export const MATTRESS: SpriteDef = {
  colors: { k: "#2c4f8f", m: "#3f6fc4", n: "#6f9ee6" },
  rows: [
    ".kkkk.",
    "knnnnk",
    "kmmmmk",
    "kmmmmk",
    "knnnnk",
    "kmmmmk",
    "kmmmmk",
    "knnnnk",
    "kmmmmk",
    "kmmmmk",
    ".kkkk.",
  ],
};

const FIRE = { y: "#ffe08a", o: "#f2a03d", r: C.flame, t: C.trunk, T: C.trunkDark, s: C.stoneDark };
const LOGS = [
  "...oorrrroo...",
  "....orrrro....",
  "..tTttTTttTt..",
  ".tTTtttttTTTt.",
  "..ssss..ssss..",
];
export const CAMPFIRE: SpriteDef[] = [
  {
    colors: FIRE,
    rows: [
      "......y.......",
      "......yy......",
      ".....yooy.....",
      ".....orroy....",
      "....orrrro....",
      "....orrrro....",
      ...LOGS,
    ],
  },
  {
    colors: FIRE,
    rows: [
      ".......y......",
      "......yy......",
      ".....yooy.....",
      "....yorroy....",
      "....orrrro....",
      "...orrrrro....",
      ...LOGS,
    ],
  },
];

export const TENT: SpriteDef = {
  colors: { a: "#6e3b2a", B: C.ember, b: "#c94f30", d: "#3a2420" },
  rows: [
    ".......aa.......",
    "......aBBa......",
    ".....aBBbBa.....",
    "....aBBbbbBa....",
    "...aBBbbbbbBa...",
    "..aBBbbdbbbbBa..",
    ".aBBbbdddbbbbBa.",
    "aBBbbbdddbbbbbBa",
    "aaaaaaaaaaaaaaaa",
  ],
};

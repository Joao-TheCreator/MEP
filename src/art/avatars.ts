import { Grid } from "./grid";
import type { SpriteDef } from "./pixel";

/**
 * Pixel avatars (busts, 20×22) for the group. Each one is a stylized drawing
 * based on the traits in the photos the group sent — no photo is stored.
 * To add someone: append to AVATARS with a new key (never reuse/rename a key:
 * it is saved in players.avatar).
 */
export interface AvatarSpec {
  name: string;
  skin: string;
  skinShade: string;
  hair: string;
  hairLight: string;
  /** Color of the hair tips (ombré); defaults to `hair`. */
  hairTips?: string;
  /** Color of the top of the hair (dark roots on light hair). */
  hairRoots?: string;
  style: "cap" | "curly" | "long" | "short" | "coily" | "bob" | "fringe" | "shag" | "fade" | "curlyLong" | "straight";
  /** Smiling closed eyes (^ ^). */
  happyEyes?: boolean;
  /** Beard color when different from the hair (e.g. grey). */
  beardColor?: string;
  shirtDetail?: "stripes" | "letters" | "cardigan" | "suit" | "straps" | "turtleneck";
  /** Full-body sprites (walker.ts): pants and shoes colors. */
  pants?: string;
  pantsShade?: string;
  shoes?: string;
  /** Group leader: gets the flame pin from the church logo. */
  leader?: boolean;
  glasses?: string;
  cap?: { color: string; brim: string; mark?: string };
  facialHair?: "mustache" | "beard" | "goatee" | "full";
  smile?: boolean;
  blush?: boolean;
  freckles?: boolean;
  lips?: string;
  shirt: string;
  shirtShade: string;
  shirtTrim?: string;
}

export const AVATARS = {
  "joao-pedro": {
    name: "João Pedro",
    skin: "#e8b48e", skinShade: "#c99270",
    hair: "#33241e", hairLight: "#4a362c",
    style: "cap",
    cap: { color: "#2b2a2f", brim: "#1c1b20", mark: "#6b6a70" },
    facialHair: "beard",
    shirt: "#4a4a55", shirtShade: "#383842",
  },
  drielly: {
    name: "Drielly",
    skin: "#ecbc98", skinShade: "#d29d7b",
    hair: "#3a2823", hairLight: "#563c31",
    style: "long",
    blush: true, lips: "#c9636a",
    shirt: "#f3eee4", shirtShade: "#d9d2c3",
  },
  hernnane: {
    name: "Hernnane",
    skin: "#c98c64", skinShade: "#a86f4c",
    hair: "#1e191b", hairLight: "#3a3032",
    style: "curly",
    shirt: "#2a2a30", shirtShade: "#1d1d22",
  },
  "gabriel-campos": {
    name: "Gabriel Campos",
    skin: "#b77a55", skinShade: "#975f3f",
    hair: "#221a18", hairLight: "#3a2e2a",
    style: "cap",
    cap: { color: "#1f1e24", brim: "#141318", mark: "#f2f2f2" },
    facialHair: "mustache", smile: true,
    shirt: "#e9e9ee", shirtShade: "#c9c9d2", shirtTrim: "#2a2a30",
  },
  heloisa: {
    name: "Heloisa",
    skin: "#f0c6a6", skinShade: "#d7a586",
    hair: "#2a2123", hairLight: "#45373a", hairTips: "#a3714d",
    style: "long",
    smile: true, freckles: true, blush: true, lips: "#d47a7e",
    shirt: "#8c6a4f", shirtShade: "#6f523c",
  },
  samuel: {
    name: "Samuel",
    skin: "#b07250", skinShade: "#8f5839",
    hair: "#1d1716", hairLight: "#382c29",
    style: "coily",
    facialHair: "goatee", smile: true,
    shirt: "#25252b", shirtShade: "#18181d",
  },
  alessandra: {
    name: "Alessandra",
    skin: "#efc3a0", skinShade: "#d4a281",
    hair: "#b98d5c", hairLight: "#d4ad78", hairRoots: "#8c6a45",
    style: "bob",
    smile: true, blush: true, lips: "#c86a68",
    shirt: "#2e2a33", shirtShade: "#211e25",
  },
  sarah: {
    name: "Sarah",
    skin: "#f0caa8", skinShade: "#d8aa88",
    hair: "#6b4a35", hairLight: "#86603f",
    style: "bob",
    glasses: "#d9c8b8",
    smile: true, blush: true, lips: "#cf7878",
    shirt: "#222226", shirtShade: "#16161a",
  },
  "samuel-choi": {
    name: "Samuel Choi",
    skin: "#e2b38c", skinShade: "#c4936d",
    hair: "#1c1718", hairLight: "#352c2c",
    style: "fringe",
    smile: true,
    shirt: "#2b2d30", shirtShade: "#1c1d20", shirtTrim: "#3d4044",
  },
  alex: {
    name: "Alex",
    skin: "#e9bf9c", skinShade: "#cc9e7b",
    hair: "#141113", hairLight: "#2c2629",
    style: "shag",
    shirt: "#1d1d22", shirtShade: "#121216",
  },
  nathan: {
    name: "Nathan",
    skin: "#dcaa84", skinShade: "#bd8b66",
    hair: "#1f1918", hairLight: "#3a2f2c",
    style: "fade",
    facialHair: "goatee",
    shirt: "#3f5a4a", shirtShade: "#2e4437",
  },
  idro: {
    name: "Idro",
    skin: "#e6b98f", skinShade: "#c79870",
    hair: "#1a1617", hairLight: "#302a2b",
    style: "cap",
    cap: { color: "#24304a", brim: "#18213a", mark: "#f0f0f0" },
    glasses: "#3e3e4a",
    smile: true,
    shirt: "#26262c", shirtShade: "#18181d",
  },
  suzana: {
    name: "Suzana",
    skin: "#efc8a6", skinShade: "#d4a886",
    hair: "#1c1819", hairLight: "#332d2e",
    style: "straight",
    lips: "#c97c78",
    shirt: "#c9c6c0", shirtShade: "#a9a69f", shirtDetail: "turtleneck",
  },
  carol: {
    name: "Carol",
    skin: "#e4b68f", skinShade: "#c6966f",
    hair: "#1d1716", hairLight: "#3b2f2c",
    style: "curlyLong",
    glasses: "#4a3f45",
    smile: true, happyEyes: true,
    shirt: "#a9cbe6", shirtShade: "#86aed0", shirtTrim: "#f4f6fa", shirtDetail: "stripes",
  },
  sofia: {
    name: "Sofia",
    skin: "#f1c9a6", skinShade: "#d8aa86",
    hair: "#2a1f1d", hairLight: "#45342f",
    style: "long",
    smile: true, happyEyes: true, blush: true, lips: "#d07c78",
    shirt: "#1f1e22", shirtShade: "#141317", shirtTrim: "#f2f2f2", shirtDetail: "letters",
  },
  stephany: {
    name: "Stephany",
    skin: "#f0c9a7", skinShade: "#d6a987",
    hair: "#221b1b", hairLight: "#3c3130",
    style: "long",
    smile: true, blush: true, lips: "#d2817c",
    shirt: "#c4d9ea", shirtShade: "#a3bed5", shirtTrim: "#1f1e22", shirtDetail: "cardigan",
  },
  bniel: {
    name: "Bniel",
    skin: "#ecc19c", skinShade: "#d0a17d",
    hair: "#1b1718", hairLight: "#332c2d",
    style: "fringe",
    glasses: "#8a8580",
    smile: true,
    shirt: "#c9c2e0", shirtShade: "#aaa2c8", shirtTrim: "#1d1d22", shirtDetail: "straps",
  },
  leine: {
    name: "Leine",
    skin: "#efc6a3", skinShade: "#d5a684",
    hair: "#161314", hairLight: "#2e292a",
    style: "long",
    smile: true, blush: true, lips: "#cf6f6c",
    shirt: "#f4f0e8", shirtShade: "#d9d3c6", shirtTrim: "#c8343b", shirtDetail: "cardigan",
  },
  rodrigo: {
    name: "Rodrigo",
    skin: "#e3b48f", skinShade: "#c4936f",
    hair: "#231c1a", hairLight: "#3d322e",
    style: "fade",
    facialHair: "full",
    shirt: "#f2f2f4", shirtShade: "#d4d4da", shirtTrim: "#22232b", shirtDetail: "suit",
  },
  diego: {
    name: "Diego (Jondo)",
    skin: "#e2ae8a", skinShade: "#c38f6c",
    hair: "#2a2220", hairLight: "#463a35",
    style: "short",
    facialHair: "full", beardColor: "#6f625b",
    smile: true,
    shirt: "#26252b", shirtShade: "#18181d",
    leader: true,
  },
} satisfies Record<string, AvatarSpec>;

export type AvatarKey = keyof typeof AVATARS;
export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export function avatarSprite(spec: AvatarSpec): SpriteDef {
  const g = new Grid(20, 22);
  const long = spec.style === "long";

  // long hair behind the head/shoulders
  if (long) {
    g.rect(3, 4, 14, 14, "h");
    g.rect(2, 9, 2, 10, "h");
    g.rect(16, 9, 2, 10, "h");
    g.rect(4, 18, 2, 2, "h");
    g.rect(14, 18, 2, 2, "h");
  }

  // shirt / shoulders
  g.rect(3, 17, 14, 5, "s");
  g.rect(2, 18, 16, 4, "s");
  g.rect(2, 21, 16, 1, "S");
  g.rect(2, 18, 1, 4, "S");
  g.rect(17, 18, 1, 4, "S");
  switch (spec.shirtDetail) {
    case "stripes":
      for (let x = 3; x < 17; x += 2) g.rect(x, 18, 1, 4, "t");
      g.stamp(7, 17, ["tt....tt"]);
      break;
    case "letters":
      g.stamp(6, 18, [".tt..t.t", "t..t.ttt", ".tt....t"]);
      break;
    case "cardigan":
      g.rect(2, 18, 4, 4, "t");
      g.rect(14, 18, 4, 4, "t");
      g.rect(3, 17, 3, 1, "t");
      g.rect(14, 17, 3, 1, "t");
      break;
    case "suit":
      g.rect(2, 18, 6, 4, "t");
      g.rect(12, 18, 6, 4, "t");
      g.rect(3, 17, 5, 1, "t");
      g.rect(12, 17, 5, 1, "t");
      g.stamp(7, 17, [".s..s.", "..ss..", "..ss.."]);
      break;
    case "straps":
      g.rect(4, 17, 2, 5, "t");
      g.rect(14, 17, 2, 5, "t");
      g.stamp(8, 17, ["S..S"]);
      break;
    default:
      if (spec.shirtTrim) g.stamp(7, 17, ["tt....tt", ".tt..tt."]);
  }
  // neck
  g.rect(8, 15, 4, 3, "K");
  g.rect(9, 17, 2, 1, "k");
  if (spec.shirtDetail === "turtleneck") {
    g.rect(7, 15, 6, 3, "s");
    g.rect(7, 15, 6, 1, "S");
  }
  if (spec.leader) g.stamp(5, 18, [".p", "pP", "PP"]);

  // head
  g.rect(5, 4, 10, 11, "k");
  g.rect(6, 14, 8, 1, "k");
  g.set(5, 14, ".");
  g.set(14, 14, ".");
  g.rect(14, 5, 1, 9, "K"); // soft shade on the right
  g.rect(4, 8, 1, 3, "k"); // ears
  g.rect(15, 8, 1, 3, "K");

  // eyes + brows
  if (spec.happyEyes) {
    g.stamp(6, 9, [".e....e.", "e.e..e.e"]);
  } else {
    g.rect(7, 9, 1, 2, "e");
    g.rect(12, 9, 1, 2, "e");
    g.set(8, 9, "w");
    g.set(13, 9, "w");
  }
  const browThick = spec.style === "curly";
  g.rect(6, 7, 3, browThick ? 2 : 1, "h");
  g.rect(11, 7, 3, browThick ? 2 : 1, "h");
  if (browThick) {
    g.set(6, 8, "k");
    g.set(13, 8, "k");
  }
  // nose
  g.set(10, 11, "K");
  g.set(10, 12, "K");

  // mouth
  if (!spec.smile) g.rect(9, 13, 2, 1, "m");
  else {
    g.rect(9, 13, 2, 1, "w");
    g.set(8, 12, "m");
    g.set(11, 12, "m");
    g.set(8, 13, "m");
    g.set(11, 13, "m");
  }

  if (spec.blush) {
    g.set(6, 12, "b");
    g.set(13, 12, "b");
  }
  if (spec.freckles) {
    g.set(7, 11, "K");
    g.set(8, 12, "K");
    g.set(12, 11, "K");
    g.set(13, 11, "K");
  }
  if (spec.facialHair === "mustache") g.rect(9, 12, 2, 1, "h");
  if (spec.facialHair === "goatee") {
    g.rect(8, 12, 4, 1, "h");
    g.rect(8, 14, 4, 1, "h");
    g.rect(9, 15, 2, 1, "h");
  }
  if (spec.facialHair === "full") {
    g.rect(8, 12, 4, 1, "z");
    g.rect(5, 11, 1, 3, "z");
    g.rect(14, 11, 1, 3, "z");
    g.rect(6, 13, 2, 1, "z");
    g.rect(12, 13, 2, 1, "z");
    g.rect(6, 14, 8, 1, "z");
    g.rect(7, 15, 6, 1, "z");
    g.set(8, 13, "Z");
    g.set(11, 13, "Z");
  }
  if (spec.facialHair === "beard") {
    g.rect(8, 12, 4, 1, "h");
    g.rect(6, 13, 1, 1, "f");
    g.rect(13, 13, 1, 1, "f");
    g.rect(6, 14, 8, 1, "f");
    g.rect(8, 15, 4, 1, "f");
    g.set(5, 12, "f");
    g.set(14, 12, "f");
  }

  // hair / headwear on top
  switch (spec.style) {
    case "cap":
      g.rect(5, 6, 1, 3, "h"); // sideburns
      g.rect(14, 6, 1, 3, "h");
      g.stamp(4, 1, [
        "...cccccc...",
        "..cccccccc..",
        ".cccccccccc.",
        ".cccccccccc.",
        "CCCCCCCCCCCC",
        ".CCCCCCCCCC.",
      ]);
      if (spec.cap?.mark) g.stamp(9, 2, ["xx", "x."]);
      break;
    case "curly":
      g.stamp(2, 0, [
        "....hHhHhHhh....",
        "..hHhhHhhHhHhh..",
        ".hHhHhhhHhhhHhH.",
        "hhHhhHhHhhHhhHhh",
        "HhhHhhhHhHhhHhhH",
        "hHhhHhHhhhHhHhhh",
        ".hHhh.Hh.hH.hHh.",
        ".hhh........hhh.",
        "..h..........h..",
      ]);
      break;
    case "long":
      g.stamp(3, 1, [
        "....hhhhhh....",
        "..hhHhhhhHhh..",
        ".hhhhHhhhhhHh.",
        "hhhhhhhHhhhhhh",
        "hhhhhh.hhhhhhh",
        "hhh.........hh",
        "hh..........hh",
      ]);
      break;
    case "fade":
      g.rect(5, 5, 1, 4, "f");
      g.rect(14, 5, 1, 4, "f");
      g.stamp(4, 1, [
        "...hHhhHh...",
        "..hHhHhhHhh.",
        ".hhHhhHhHhhh",
        ".ffhhhhhhhff",
        ".ff.......ff",
      ]);
      break;
    case "curlyLong":
      // shoulder-length curls, close to the head
      g.rect(3, 5, 2, 12, "h");
      g.rect(15, 5, 2, 12, "h");
      g.rect(2, 8, 1, 8, "h");
      g.rect(17, 8, 1, 8, "h");
      for (let y = 6; y < 17; y += 2) {
        g.set(3 + (y % 4 === 0 ? 0 : 1), y, "H");
        g.set(15 + (y % 4 === 0 ? 1 : 0), y, "H");
      }
      g.stamp(3, 1, [
        "...hHhHhhH....",
        ".hHhhHhHhhHhh.",
        "hHhHhhHhhHhhHh",
        "hhHhhHhHhHhhHh",
        "hHhh.hHh..hHhh",
        "hh..........hh",
      ]);
      break;
    case "straight":
      g.rect(3, 5, 2, 12, "h");
      g.rect(15, 5, 2, 12, "h");
      g.rect(2, 13, 2, 4, "h");
      g.rect(16, 13, 2, 4, "h");
      g.stamp(3, 1, [
        "...hhhhhhhh...",
        ".hhhhHhhhhhhh.",
        "hhhhhhHhhhhhhh",
        "hhhhhhhhhHhhhh",
        "hhhh...hhhhhhh",
        "hh.........hhh",
      ]);
      break;
    case "coily":
      g.stamp(4, 2, [
        "..hHhHhHhh..",
        ".hHhHhHhHhH.",
        "hHhHhHhHhHhH",
        "hHhHhhHhHhHh",
        "hh........hh",
        "h..........h",
      ]);
      break;
    case "bob":
      g.rect(3, 6, 2, 10, "h");
      g.rect(15, 6, 2, 10, "h");
      g.stamp(3, 1, [
        "...hhhhhhhh...",
        ".hhhHhhhhHhhh.",
        "hhhhhhhhhhhhhh",
        "hhHhhHhhHhhHhh",
        "hhhhhhhhhhhhhh",
        "hhhhHhhhhHhhhh",
        "hh..........hh",
      ]);
      break;
    case "fringe":
      g.stamp(4, 2, [
        "..hhhhhhh...",
        ".hhhHhhhhhh.",
        "hhhhhhHhhhhh",
        "hhHhhhhhhHhh",
        "hhhhhHhh.hhh",
        "h.hh.h....hh",
      ]);
      break;
    case "shag":
      g.rect(4, 6, 2, 7, "h");
      g.rect(14, 6, 2, 7, "h");
      g.stamp(3, 1, [
        "...hhhhhhhh...",
        "..hhHhhhhhHh..",
        ".hhhhhHhhhhhh.",
        "hhHhhhhhhhHhhh",
        "hhhhhHhhhhhhhh",
        "hhhhhhhHhhhhhh",
        ".hhHhhhhhhHhh.",
        ".h.h.hh.h.hh..",
      ]);
      break;
    case "short":
      g.stamp(4, 2, ["..hhhhhh..", ".hhhhHhhhh.", "hhHhhhhhhHh", "hh.......hh"]);
      break;
  }

  if (spec.glasses) {
    // thin frames around a single eye pixel; lenses stay see-through
    g.stamp(6, 9, ["ggg..ggg", "geggggeg"]);
    if (!spec.happyEyes) {
      g.set(7, 11, "e");
      g.set(12, 11, "e");
    }
  }

  // dark roots on top / ombré tips at the bottom
  const rows = g.rows().map((row, y) => {
    if (spec.hairRoots && y <= 2) return row.replace(/[hH]/g, "r");
    if (spec.hairTips && y >= 14) return row.replace(/h/g, "o");
    return row;
  });

  return {
    rows,
    colors: {
      k: spec.skin, K: spec.skinShade,
      h: spec.hair, H: spec.hairLight, o: spec.hairTips ?? spec.hair, r: spec.hairRoots ?? spec.hair,
      g: spec.glasses ?? spec.hair,
      z: spec.beardColor ?? spec.hair, Z: mix(spec.beardColor ?? spec.hair, spec.skin),
      p: "#f0566a", P: "#de4a47",
      f: mix(spec.hair, spec.skin),
      e: "#2a1d1d", w: "#fbf7ef",
      m: spec.lips ?? "#a65a55", b: "#ef9a94",
      s: spec.shirt, S: spec.shirtShade, t: spec.shirtTrim ?? spec.shirtShade,
      c: spec.cap?.color ?? spec.hair, C: spec.cap?.brim ?? spec.hair, x: spec.cap?.mark ?? spec.hair,
    },
  };
}

/** 50/50 color mix — used for stubble. */
function mix(a: string, b: string) {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round((p(a, i) + p(b, i)) / 2).toString(16).padStart(2, "0")).join("");
}

export const AVATAR_SPRITES = Object.fromEntries(
  AVATAR_KEYS.map((k) => [k, avatarSprite(AVATARS[k])]),
) as Record<AvatarKey, SpriteDef>;

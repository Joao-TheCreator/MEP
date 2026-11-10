import { AVATARS, AVATAR_KEYS, avatarSprite, type AvatarKey, type AvatarSpec } from "./avatars";
import { Grid } from "./grid";
import type { SpriteDef } from "./pixel";

/**
 * Full-body walking sprites (18×26), built from the same AvatarSpec as the
 * portrait busts: the head is cropped from the bust, then a small body, arms,
 * legs and shoes are drawn below it.
 *
 * Directions: down (facing the player), up (back), right, left (mirror of right).
 * Frames per direction: [idle, stepA, stepB].
 */
export const WALKER_W = 18;
export const WALKER_H = 26;

export type Direction = "down" | "up" | "right" | "left";
export type WalkerFrames = Record<Direction, SpriteDef[]>;

const DEFAULT_PANTS = "#3f4a66";
const DEFAULT_PANTS_SHADE = "#313a52";
const DEFAULT_SHOES = "#3a2a24";

/** Characters that belong to the face (skin, eyes, mouth, glasses, beard). */
const FACE = new Set(["k", "K", "e", "w", "m", "b", "g", "f", "z", "Z"]);

/** Bust rows 0..16 and columns 1..18 → walker head (head spans x 4..13). */
function headGrid(spec: AvatarSpec): { g: Grid; colors: Record<string, string> } {
  const bust = avatarSprite(spec);
  const g = new Grid(WALKER_W, WALKER_H);
  for (let y = 0; y <= 16; y++) {
    for (let x = 0; x < WALKER_W; x++) g.set(x, y, bust.rows[y][x + 1] ?? ".");
  }
  // the bust's shoulders start at row 17; drop anything that leaked into row 16 sides
  for (let x = 0; x < WALKER_W; x++) if (x < 6 || x > 11) if (g.get(x, 16) === "s" || g.get(x, 16) === "S") g.set(x, 16, ".");
  return { g, colors: bust.colors };
}

const LONG_STYLES = new Set(["long", "straight", "curlyLong", "bob"]);

function drawBody(g: Grid, spec: AvatarSpec, dir: Direction, frame: number) {
  const side = dir === "right" || dir === "left";
  const long = LONG_STYLES.has(spec.style);

  // long hair falling over the shoulders (front) or down the back
  if (long && dir === "down") {
    g.rect(2, 16, 2, spec.style === "bob" ? 1 : 3, "h");
    g.rect(14, 16, 2, spec.style === "bob" ? 1 : 3, "h");
  }

  // torso + shoulders
  if (side) {
    g.rect(6, 17, 6, 1, "s");
    g.rect(6, 18, 6, 4, "s");
    g.rect(11, 18, 1, 4, "S");
  } else {
    g.rect(5, 17, 8, 1, "s");
    g.rect(5, 18, 8, 4, "s");
    g.rect(12, 18, 1, 4, "S");
    g.rect(5, 21, 8, 1, "S");
  }

  // shirt details (front only, kept subtle at this size)
  if (dir === "down") {
    switch (spec.shirtDetail) {
      case "stripes": for (let x = 5; x <= 12; x += 2) g.rect(x, 18, 1, 3, "t"); break;
      case "cardigan": g.rect(5, 17, 2, 5, "t"); g.rect(11, 17, 2, 5, "t"); break;
      case "suit": g.rect(5, 17, 3, 5, "t"); g.rect(10, 17, 3, 5, "t"); g.rect(8, 18, 2, 3, "s"); break;
      case "straps": g.rect(6, 17, 1, 5, "t"); g.rect(11, 17, 1, 5, "t"); break;
      case "letters": g.stamp(6, 19, ["t.tt.t"]); break;
      default: if (spec.shirtTrim) g.stamp(7, 17, ["t..t"]);
    }
  } else if (dir === "up" && (spec.shirtDetail === "straps")) {
    g.rect(6, 17, 6, 4, "t"); // backpack
    g.rect(7, 18, 4, 2, "T");
  }
  if (spec.leader && dir === "down") g.stamp(6, 18, ["p"]);

  // arms swing opposite to legs
  const swing = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  if (side) {
    const ax = 8 + swing; // single visible arm
    g.rect(ax, 18, 1, 3, "s");
    g.set(ax, 21, "k");
  } else {
    g.rect(4, 18 + (swing > 0 ? 0 : 0), 1, 3, "s");
    g.rect(13, 18, 1, 3, "s");
    g.set(4, 21 - (swing === 1 ? 1 : 0), "k");
    g.set(13, 21 - (swing === -1 ? 1 : 0), "k");
  }

  // belt / pants
  if (side) g.rect(6, 22, 6, 1, "Q");
  else g.rect(5, 22, 8, 1, "Q");

  // legs + shoes
  if (side) {
    if (frame === 0) {
      g.rect(7, 23, 4, 2, "q");
      g.rect(7, 25, 5, 1, "n");
    } else {
      // stride: front and back leg apart
      g.rect(6, 23, 2, 2, "q");
      g.rect(10, 23, 2, 2, "Q");
      g.rect(5, 25, 3, 1, "n");
      g.rect(10, 25, 3, 1, "n");
    }
  } else {
    const liftL = frame === 1 ? 1 : 0;
    const liftR = frame === 2 ? 1 : 0;
    g.rect(6, 23, 2, 2 - liftL, "q");
    g.rect(10, 23, 2, 2 - liftR, "q");
    g.rect(6, 25 - liftL, 2, 1, "n");
    g.rect(10, 25 - liftR, 2, 1, "n");
    g.set(7, 23, "Q");
    g.set(11, 23, "Q");
  }
}

/** Back of the head: hair covers the face; cap brim and logo disappear. */
function toBack(g: Grid) {
  for (let y = 0; y <= 16; y++) {
    for (let x = 0; x < WALKER_W; x++) {
      const c = g.get(x, y);
      if (c === "C" || c === "x") g.set(x, y, "c");
      if (!FACE.has(c)) continue;
      const inHead = x >= 4 && x <= 13 && y >= 3 && y <= 14;
      if (inHead) g.set(x, y, (x * 3 + y) % 7 === 0 ? "H" : "h");
      else if (y >= 15) g.set(x, y, c === "z" || c === "f" ? "K" : c);
    }
  }
  // ears stay visible
  g.rect(3, 8, 1, 2, "k");
  g.rect(14, 8, 1, 2, "K");
}

/** Facing right: face features slide 1px right, back of the head becomes hair. */
function toRight(g: Grid) {
  const src = g.cells.map((r) => [...r]);
  for (let y = 6; y <= 15; y++) {
    for (let x = 13; x >= 5; x--) {
      const c = src[y][x - 1];
      if (FACE.has(src[y][x]) || FACE.has(c)) g.set(x, y, FACE.has(c) ? c : "k");
    }
  }
  // the far eye, far lens and far brow hide behind the head
  for (let y = 6; y <= 12; y++) {
    for (let x = 4; x <= 9; x++) {
      const c = g.get(x, y);
      if (c === "e" || c === "w" || c === "g") g.set(x, y, "k");
      if (c === "h" && y >= 7 && y <= 8 && x >= 6) g.set(x, y, "k");
    }
  }
  // back of the head
  for (let y = 4; y <= 12; y++) {
    for (let x = 4; x <= 7; x++) if (FACE.has(g.get(x, y)) || g.get(x, y) === ".") g.set(x, y, (x + y) % 6 === 0 ? "H" : "h");
  }
  g.rect(3, 6, 1, 6, "h");
  // nape: no skin block behind the jaw
  // (long hair keeps falling down the back instead)
  for (let y = 13; y <= 15; y++) {
    for (let x = 3; x <= 6; x++) {
      if (!FACE.has(g.get(x, y))) continue;
      const hairAbove = ["h", "H", "o", "r"].includes(g.get(x, 12));
      g.set(x, y, hairAbove && y <= 14 ? "h" : ".");
    }
  }
  g.rect(7, 9, 1, 2, "K"); // ear
  g.rect(14, 8, 1, 3, "k"); // cheek line
  g.set(14, 11, "k"); // nose tip
  g.set(15, 11, "K");
  for (let y = 0; y < 16; y++) for (const x of [15, 16, 17]) if (FACE.has(g.get(x, y))) g.set(x, y, ".");
  // cap brim points forward
  for (let x = 0; x < WALKER_W; x++) {
    if (g.get(x, 5) === "C") g.set(x, 5, x < 8 ? "c" : "C");
  }
  if (g.get(14, 5) === "C") {
    g.set(15, 5, "C");
    g.set(16, 5, "C");
  }
}

function mirror(s: SpriteDef): SpriteDef {
  return { colors: s.colors, rows: s.rows.map((r) => [...r].reverse().join("")) };
}

export function walkerFrames(spec: AvatarSpec): WalkerFrames {
  const make = (dir: Direction, frame: number): SpriteDef => {
    const { g, colors } = headGrid(spec);
    if (dir === "up") toBack(g);
    if (dir === "right" || dir === "left") toRight(g);
    drawBody(g, spec, dir, frame);
    return {
      rows: g.rows(),
      colors: {
        ...colors,
        q: spec.pants ?? DEFAULT_PANTS,
        Q: spec.pantsShade ?? DEFAULT_PANTS_SHADE,
        n: spec.shoes ?? DEFAULT_SHOES,
        T: "#00000033",
      },
    };
  };
  const right = [0, 1, 2].map((f) => make("right", f));
  return {
    down: [0, 1, 2].map((f) => make("down", f)),
    up: [0, 1, 2].map((f) => make("up", f)),
    right,
    left: right.map(mirror),
  };
}

export const WALKERS = Object.fromEntries(
  AVATAR_KEYS.map((k) => [k, walkerFrames(AVATARS[k])]),
) as Record<AvatarKey, WalkerFrames>;

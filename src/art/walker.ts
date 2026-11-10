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

const HAIR = new Set(["h", "H", "o", "r"]);

/**
 * Facing right: a real profile. Keeps the hair silhouette from the front view,
 * turns the back half of the head into hair and redraws the face features
 * (eye, brow, nose, mouth, ear, beard, glasses, cap brim) on the right side.
 */
function toRight(g: Grid, spec: AvatarSpec) {
  const long = LONG_STYLES.has(spec.style);
  const bigHair = spec.style === "curly" || spec.style === "curlyLong";

  // 1. wipe the front face and anything hanging on the face side
  for (let y = 6; y <= 16; y++) {
    for (let x = 9; x < WALKER_W; x++) {
      const inHead = x <= 13 && y <= 14;
      if (y <= 6 && HAIR.has(g.get(x, y))) continue; // keep bangs on the forehead
      if (inHead) g.set(x, y, "k");
      else if (y <= 14 || !["K", "s", "S"].includes(g.get(x, y))) g.set(x, y, ".");
    }
  }
  // the forehead hairline: whatever hair the front view had at row 6 stays
  // 2. back of the head is hair
  const backBottom = long ? 16 : 12;
  for (let y = 5; y <= backBottom; y++) {
    const x0 = bigHair ? 2 : long ? 3 : 4;
    for (let x = x0; x <= 8; x++) {
      if (y > 12 && x > 7) continue;
      g.set(x, y, (x * 3 + y) % 7 === 0 ? "H" : "h");
    }
  }
  if (!long) {
    // nape: clear the old jaw behind the neck
    for (let y = 13; y <= 14; y++) for (let x = 3; x <= 6; x++) g.set(x, y, ".");
    g.rect(7, 13, 2, 2, "k");
  }
  // leftovers of the front beard under the jaw become neck
  if (!long) for (let y = 14; y <= 16; y++) for (let x = 6; x <= 10; x++) if (y >= 15 && g.get(x, y) !== "." && !["K", "s", "S"].includes(g.get(x, y))) g.set(x, y, x >= 7 && x <= 10 ? "K" : ".");
  // 3. face features (profile)
  g.rect(9, 9, 1, 2, "K"); // ear
  g.set(9, 11, "K");
  g.rect(10, 7, 3, spec.style === "curly" ? 2 : 1, "h"); // brow
  g.rect(12, 9, 1, 2, "e"); // eye
  if (!spec.happyEyes) g.set(11, 9, "w");
  else { g.set(12, 9, "k"); g.set(11, 10, "e"); g.set(13, 10, "e"); g.set(12, 10, "k"); g.set(12, 9, "e"); }
  g.set(14, 10, "k"); // nose
  g.set(14, 11, "k");
  g.set(13, 11, "K");
  g.rect(13, 5, 1, 1, g.get(13, 5) === "." ? "k" : g.get(13, 5));
  g.set(13, 13, "m"); // mouth
  if (spec.smile) { g.set(12, 13, "m"); g.set(13, 12, "m"); g.set(13, 13, "w"); }
  if (spec.blush) g.set(11, 12, "b");
  if (spec.freckles) { g.set(11, 11, "K"); g.set(12, 11, "K"); }
  // chin + jaw
  g.rect(9, 14, 4, 1, "k");
  g.set(13, 14, ".");
  g.set(9, 13, "K");

  // 4. facial hair
  if (spec.facialHair === "mustache") g.rect(12, 12, 2, 1, "h");
  if (spec.facialHair === "goatee") { g.rect(12, 12, 2, 1, "h"); g.rect(11, 14, 2, 1, "h"); }
  if (spec.facialHair === "beard") { g.rect(12, 12, 2, 1, "h"); g.rect(9, 12, 1, 2, "f"); g.rect(10, 13, 2, 2, "f"); g.set(12, 14, "f"); }
  if (spec.facialHair === "full") {
    g.rect(9, 11, 1, 4, "z");
    g.rect(10, 12, 1, 3, "z");
    g.rect(11, 13, 2, 2, "z");
    g.rect(12, 12, 2, 1, "z");
    g.set(13, 13, "m");
    g.rect(10, 15, 3, 1, "z");
  }

  // 5. glasses: frame across the eye, arm back to the ear
  if (spec.glasses) {
    g.rect(10, 9, 1, 1, "g");
    g.rect(11, 8, 3, 1, "g");
    g.set(13, 9, "g");
    g.set(13, 10, "g");
    g.set(11, 9, "k");
  }

  // 6. cap: crown stays, brim points forward
  if (spec.style === "cap") {
    for (let x = 0; x < WALKER_W; x++) if (g.get(x, 5) === "C") g.set(x, 5, "c");
    g.rect(9, 5, 8, 1, "C");
    for (let x = 0; x < WALKER_W; x++) if (g.get(x, 2) === "x" || g.get(x, 3) === "x") { g.set(x, 2, g.get(x, 2) === "x" ? "c" : g.get(x, 2)); g.set(x, 3, g.get(x, 3) === "x" ? "c" : g.get(x, 3)); }
    g.set(11, 3, "x");
    g.set(12, 3, "x");
    g.rect(4, 6, 2, 3, "h"); // hair under the cap at the back
  }
}

function mirror(s: SpriteDef): SpriteDef {
  return { colors: s.colors, rows: s.rows.map((r) => [...r].reverse().join("")) };
}

export function walkerFrames(spec: AvatarSpec): WalkerFrames {
  const make = (dir: Direction, frame: number): SpriteDef => {
    const { g, colors } = headGrid(spec);
    if (dir === "up") toBack(g);
    if (dir === "right" || dir === "left") toRight(g, spec);
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

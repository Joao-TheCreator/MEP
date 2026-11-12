import { C } from "./palette";
import { Grid, rng } from "./grid";
import { SpriteRects, spriteSize, type SpriteDef } from "./pixel";
import {
  BARN, CONSTRUCTION, HOUSE, MILL, PALM, POOL, TREE, TREE_DARK, WELL, templeSprite,
} from "./sprites";
import { CROPS, FORGE, PEN, SAWMILL } from "./workplaces";

/**
 * Pixel map of the farm, laid out after the satellite view of the Chácara
 * Coreana: open field top-left, dense forest around, pool in the middle,
 * the main temple just below it, small tile-roof houses to the south-west.
 */
export const MAP_W = 160;
export const MAP_H = 120;

type Rect = { x: number; y: number; w: number; h: number };

const TEMPLE = templeSprite();
const ANNEX = templeSprite(30);

const PLACES = {
  temple: { x: 68, y: 52 },
  pool: { x: 64, y: 34 },
  houseA: { x: 30, y: 84 },
  houseB: { x: 10, y: 98 },
  annex: { x: 118, y: 6 }, // the other building, top-right
  well: { x: 46, y: 40 },
  barn: { x: 38, y: 62 },
  mill: { x: 100, y: 26 },
  // work places of the four professions (roadmap 1b)
  cropsA: { x: 22, y: 3 },
  cropsB: { x: 4, y: 19 },
  pen: { x: 4, y: 40 },
  sawmill: { x: 134, y: 60 },
  forge: { x: 132, y: 96 },
};

/** Where the campfire burns (its feet), south of the temple. */
export const FIRE_SPOT = { x: 84, y: 100 };

function box(p: { x: number; y: number }, s: SpriteDef, pad = 2): Rect {
  const { w, h } = spriteSize(s);
  return { x: p.x - pad, y: p.y - pad, w: w + pad * 2, h: h + pad * 2 };
}

const FIELD: Rect = { x: 0, y: 0, w: 58, h: 30 };

const CLEARINGS: Rect[] = [
  FIELD,
  box(PLACES.temple, TEMPLE, 3),
  box(PLACES.pool, POOL, 3),
  box(PLACES.houseA, HOUSE, 2),
  box(PLACES.houseB, HOUSE, 2),
  box(PLACES.annex, ANNEX, 2),
  box(PLACES.well, WELL, 2),
  box(PLACES.barn, BARN, 2),
  box(PLACES.mill, MILL, 2),
  box(PLACES.pen, PEN, 2),
  box(PLACES.sawmill, SAWMILL, 2),
  box(PLACES.forge, FORGE, 2),
  { x: FIRE_SPOT.x - 13, y: FIRE_SPOT.y - 10, w: 26, h: 20 }, // camp around the fire
  // paths
  { x: 56, y: 44, w: 10, h: 40 },
  { x: 26, y: 78, w: 34, h: 8 },
  { x: 26, y: 51, w: 30, h: 6 }, // well → pen
  { x: 124, y: 84, w: 12, h: 24 }, // temple → east yard → forge
  { x: 134, y: 70, w: 10, h: 16 }, // east yard → sawmill
  { x: 82, y: 84, w: 8, h: 8 }, // temple door → camp
];

const inside = (x: number, y: number, r: Rect) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function ground(): SpriteDef {
  const g = new Grid(MAP_W, MAP_H, "g");
  const rand = rng(7);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const r = rand();
      if (inside(x, y, FIELD) && !(x + y > 62)) {
        // mowed field with soft diagonal stripes
        g.set(x, y, ((x + y) >> 2) % 2 === 0 ? "f" : "F");
        if (r < 0.04) g.set(x, y, "g");
      } else if (r < 0.12) g.set(x, y, "G");
      else if (r < 0.2) g.set(x, y, "h");
    }
  }
  // dirt paths: temple → houses, field → pool
  for (let y = 46; y < 84; y++) for (let x = 58; x < 62; x++) g.set(x + ((y >> 3) % 2), y, rand() < 0.15 ? "D" : "d");
  for (let x = 24; x < 62; x++) for (let y = 80; y < 83; y++) g.set(x, y + ((x >> 4) % 2), rand() < 0.15 ? "D" : "d");
  // dirt paths to the work places and the camp (roadmap 1b)
  for (let x = 28; x < 56; x++) for (let y = 53; y < 55; y++) g.set(x, y, rand() < 0.15 ? "D" : "d");
  for (let x = 124; x < 131; x++) for (let y = 86; y < 88; y++) g.set(x, y, rand() < 0.15 ? "D" : "d");
  for (let y = 86; y < 108; y++) for (let x = 128; x < 130; x++) g.set(x, y, rand() < 0.15 ? "D" : "d");
  for (let y = 72; y < 88; y++) for (let x = 138; x < 140; x++) g.set(x, y, rand() < 0.15 ? "D" : "d");
  for (let y = 0; y < 16; y++) for (let x = -11; x < 12; x++) {
    // trodden earth around the campfire
    if ((x * x) / 121 + ((y - 8) * (y - 8)) / 64 < 1 && rand() > 0.25) g.set(FIRE_SPOT.x + x, FIRE_SPOT.y - 8 + y, rand() < 0.2 ? "D" : "d");
  }
  // stone patio around temple + pool
  for (let y = 44; y < 52; y++) for (let x = 62; x < 100; x++) if (rand() > 0.08) g.set(x, y, rand() < 0.2 ? "S" : "s");
  return {
    rows: g.rows(),
    colors: {
      g: C.grass, G: C.grassDark, h: C.grassLight, f: "#a5c46a", F: "#97b95e",
      d: C.dirt, D: C.dirtDark, s: C.stone, S: C.stoneDark,
    },
  };
}

function trees() {
  const rand = rng(42);
  const out: { s: SpriteDef; x: number; y: number }[] = [];
  for (let y = -6; y < MAP_H; y += 7) {
    for (let x = -6; x < MAP_W; x += 8) {
      const tx = x + Math.floor(rand() * 5);
      const ty = y + Math.floor(rand() * 4);
      const s = rand() < 0.2 ? PALM : rand() < 0.45 ? TREE_DARK : TREE;
      const { w, h } = spriteSize(s);
      const foot = { x: tx, y: ty, w, h };
      const blocked = CLEARINGS.some(
        (c) => foot.x < c.x + c.w && foot.x + foot.w > c.x && foot.y < c.y + c.h && foot.y + foot.h > c.y,
      );
      if (!blocked) out.push({ s, x: tx, y: ty });
    }
  }
  return out;
}

export const GROUND = ground();
const TREES = trees();

export interface FarmMapProps {
  /** Keys of completed community buildings. */
  completed: string[];
  /** Key of the building under construction, if any. */
  building?: string | null;
  className?: string;
}

export type WorkPlaceKey = "crops" | "pen" | "sawmill" | "forge";
export type PlaceKey = "temple" | "pool" | "house" | "annex" | "well" | "barn" | "mill" | WorkPlaceKey;

/** Fixed landmarks of the farm (the community buildings come from game config). */
export const LANDMARKS: Record<"temple" | "pool" | "house" | "annex" | WorkPlaceKey, { name: string; description: string }> = {
  crops: { name: "Lavoura", description: "Onde os Agricultores plantam e colhem os Grãos." },
  pen: { name: "Curral", description: "Onde os Pecuaristas cuidam do gado e tiram o Leite." },
  sawmill: { name: "Serraria", description: "Onde os Carpinteiros cortam a Madeira e fazem Tábuas." },
  forge: { name: "Forja", description: "Onde os Ferreiros derretem o Minério e batem as Ferramentas." },
  temple: { name: "Templo Dae Han", description: "O coração do sítio: tijolo aparente, arcos brancos e telhado cinza." },
  pool: { name: "Piscina", description: "Cercadinha, no meio do pátio. Lugar de reunião nos dias de calor." },
  house: { name: "Casinha", description: "Casa de telhado laranja onde o pessoal descansa." },
  annex: { name: "Anexo", description: "O outro prédio do sítio, lá no canto da mata." },
};

export interface PlacedSprite {
  s: SpriteDef;
  x: number;
  y: number;
  /** Set when the sprite is a building the player can tap. */
  place?: PlaceKey;
  /** Lies on the ground (crops): people always walk over it. */
  flat?: boolean;
}

/** Everything standing on the ground, sorted back-to-front (painter's order). */
export function farmItems(completed: string[], building?: string | null): PlacedSprite[] {
  const slot = (key: "well" | "barn" | "mill", sprite: SpriteDef): PlacedSprite | null => {
    const p = PLACES[key];
    if (completed.includes(key)) return { s: sprite, ...p, place: key };
    if (building === key) {
      const { h } = spriteSize(sprite);
      return { s: CONSTRUCTION, x: p.x, y: p.y + h - spriteSize(CONSTRUCTION).h, place: key };
    }
    return null;
  };
  const items = [
    ...TREES,
    { s: TEMPLE, ...PLACES.temple, place: "temple" as const },
    { s: POOL, ...PLACES.pool, place: "pool" as const },
    { s: HOUSE, ...PLACES.houseA, place: "house" as const },
    { s: HOUSE, ...PLACES.houseB, place: "house" as const },
    { s: ANNEX, ...PLACES.annex, place: "annex" as const },
    { s: CROPS, ...PLACES.cropsA, place: "crops" as const, flat: true },
    { s: CROPS, ...PLACES.cropsB, place: "crops" as const, flat: true },
    { s: PEN, ...PLACES.pen, place: "pen" as const },
    { s: SAWMILL, ...PLACES.sawmill, place: "sawmill" as const },
    { s: FORGE, ...PLACES.forge, place: "forge" as const },
    slot("well", WELL),
    slot("barn", BARN),
    slot("mill", MILL),
  ].filter(Boolean) as PlacedSprite[];
  return items.sort((a, b) => footY(a) - footY(b));
}

/** Bottom edge (the "feet") of a placed sprite, used for depth sorting. */
export function footY(it: PlacedSprite) {
  return it.flat ? it.y : it.y + spriteSize(it.s).h;
}

/** Static map (no people). The live version with residents is FarmScene. */
export function FarmMap({ completed, building, className }: FarmMapProps) {
  const items = farmItems(completed, building);
  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Mapa do sítio"
    >
      <SpriteRects sprite={GROUND} />
      {items.map((it, i) => (
        <SpriteRects key={i} sprite={it.s} x={it.x} y={it.y} />
      ))}
    </svg>
  );
}

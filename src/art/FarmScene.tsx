"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FIRE_SPOT, GROUND, LANDMARKS, MAP_H, MAP_W, farmItems, footY, type PlaceKey, type PlacedSprite } from "./FarmMap";
import { MAX_DARKNESS, darkness } from "./daylight";
import { MAP_FIRE, MAP_FIRE_LOW } from "./workplaces";
import { SpriteRects, spriteSize } from "./pixel";
import { rng } from "./grid";
import { WALKERS, WALKER_H, WALKER_W, type Direction } from "./walker";
import type { AvatarKey } from "./avatars";

/**
 * Live farm map: the static map plus the residents walking around it.
 * Purely cosmetic and client-side — nothing here touches game state.
 *
 * Residents are drawn at half scale (one sprite pixel = half a map pixel) so
 * their faces stay readable while the buildings keep their size; the map is
 * shown zoomed in and can be scrolled sideways.
 */

/** Walk graph: feet positions (map pixels) on paths, patio, field and yards. */
const NODES: Record<string, [number, number]> = {
  field1: [14, 14],
  field2: [30, 20],
  field3: [46, 24],
  fieldGate: [54, 32],
  poolLeft: [60, 42],
  patioW: [66, 50],
  patioMid: [80, 50],
  patioE: [94, 50],
  wellFront: [52, 54],
  pathTop: [60, 56],
  pathMid: [60, 68],
  barnFront: [46, 79],
  crossing: [60, 82],
  road: [42, 82],
  houseA: [28, 82],
  templeDoor: [92, 86],
  templeW: [72, 86],
  eastLawn: [110, 46],
  annexFront: [132, 42],
  // work places and the camp (roadmap 1b)
  penGate: [30, 55],
  eastYard: [129, 88],
  sawFront: [139, 74],
  forgeFront: [128, 108],
  camp: [84, 105],
};

/** Where each kind of resident likes to be (a node of the walk graph). */
export type Spot = "crops" | "pen" | "sawmill" | "forge" | "camp";
const SPOT_NODE: Record<Spot, string> = {
  crops: "field2",
  pen: "penGate",
  sawmill: "sawFront",
  forge: "forgeFront",
  camp: "camp",
};

const EDGES: [string, string][] = [
  ["field1", "field2"], ["field2", "field3"], ["field3", "fieldGate"], ["fieldGate", "poolLeft"],
  ["poolLeft", "patioW"], ["patioW", "patioMid"], ["patioMid", "patioE"],
  ["patioW", "pathTop"], ["poolLeft", "wellFront"], ["wellFront", "pathTop"],
  ["pathTop", "pathMid"], ["pathMid", "crossing"], ["crossing", "road"], ["road", "barnFront"],
  ["road", "houseA"], ["crossing", "templeW"], ["templeW", "templeDoor"],
  ["patioE", "eastLawn"], ["eastLawn", "annexFront"],
  ["wellFront", "penGate"], ["templeDoor", "eastYard"], ["eastYard", "sawFront"], ["eastYard", "forgeFront"],
  ["templeDoor", "camp"],
];

const NEIGHBORS: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (NEIGHBORS[a] ??= []).push(b);
  (NEIGHBORS[b] ??= []).push(a);
}
const NODE_KEYS = Object.keys(NODES);

/** Steps between every pair of nodes (the graph is small: plain BFS). */
const STEPS: Record<string, Record<string, number>> = {};
for (const start of NODE_KEYS) {
  const d: Record<string, number> = { [start]: 0 };
  const queue = [start];
  while (queue.length) {
    const n = queue.shift()!;
    for (const m of NEIGHBORS[n] ?? []) {
      if (d[m] === undefined) {
        d[m] = d[n] + 1;
        queue.push(m);
      }
    }
  }
  STEPS[start] = d;
}
/** How strongly a resident heads for their spot instead of wandering. */
const HOMING = 0.75;

const SCALE = 0.5; // map pixels per walker pixel
const SPEED = 7; // map pixels per second
const TICK_MS = 80;
const STEP_MS = 160;
const WALK_CYCLE = [1, 0, 2, 0];

export interface Resident {
  id: string;
  name: string;
  avatar: string;
  subtitle?: string;
  /** Where this resident tends to be: their work place by day, the camp at night. */
  spot?: Spot;
}

interface Mover {
  x: number;
  y: number;
  from: string;
  to: string;
  dir: Direction;
  pauseUntil: number;
  /** Personal offset from the node, so people on the same spot don't stack. */
  ox: number;
  oy: number;
  /** Their place in the ring around the campfire. */
  seat: number;
}

/** Seats around the campfire: at the sides and behind it, never in front (so the fire stays visible). */
function campSeat(i: number): [number, number] {
  const a = Math.PI * (0.9 + 1.2 * ((i * 0.618) % 1));
  const r = 7 + (i % 3) * 2.5;
  return [FIRE_SPOT.x + Math.cos(a) * r * 1.3, FIRE_SPOT.y - 1 + Math.sin(a) * r * 0.6];
}

/** Where a mover is walking to: its node plus its own offset, or its seat by the fire. */
function targetOf(m: Mover): [number, number] {
  if (m.to === "camp") return campSeat(m.seat);
  return [NODES[m.to][0] + m.ox, NODES[m.to][1] + m.oy];
}

function directionOf(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Static scenery element, memoized so animation ticks don't re-render it. */
const Scenery = memo(function Scenery({
  item,
  label,
  onPick,
}: {
  item: PlacedSprite;
  label?: string;
  onPick?: (place: PlaceKey) => void;
}) {
  if (!item.place || !onPick) return <SpriteRects sprite={item.s} x={item.x} y={item.y} />;
  const place = item.place;
  return (
    <g
      data-pick="place"
      onClick={() => onPick(place)}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={label ?? place}
    >
      <SpriteRects sprite={item.s} x={item.x} y={item.y} />
    </g>
  );
});

const Ground = memo(function Ground() {
  return <SpriteRects sprite={GROUND} />;
});

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function FarmScene({
  completed,
  building,
  residents,
  highlightId,
  zoom = 2,
  showGraph = false,
  hour = 12,
  fire,
  onFire,
  selectedPlace,
  onSelectPlace,
  placeLabels,
}: {
  completed: string[];
  building?: string | null;
  residents: Resident[];
  /** Resident to mark (usually the viewer). */
  highlightId?: string;
  /** Building currently picked (controlled; omit to let the scene keep it). */
  selectedPlace?: PlaceKey | null;
  /** Called when the player taps a building (or the ground, with null). */
  onSelectPlace?: (place: PlaceKey | null) => void;
  /** Names shown in the bubble; landmarks have defaults. */
  placeLabels?: Partial<Record<PlaceKey, string>>;
  /** How many times wider than the frame the map is drawn. */
  zoom?: number;
  /** Debug: draw the walk graph. */
  showGraph?: boolean;
  /** Hour of the day (Brasília, with fraction): the map darkens at night. */
  hour?: number;
  /** The campfire: how full it is (0–1). Omit to hide it. */
  fire?: number;
  /** Called when the player taps the campfire. */
  onFire?: () => void;
}) {
  const items = useMemo(() => farmItems(completed, building), [completed, building]);
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ownPlace, setOwnPlace] = useState<PlaceKey | null>(null);
  const place = selectedPlace !== undefined ? selectedPlace : ownPlace;
  const pickPlace = useCallback(
    (next: PlaceKey | null) => {
      setOwnPlace(next);
      onSelectPlace?.(next);
      if (next) setSelected(null);
    },
    [onSelectPlace],
  );
  const labelOf = (k: PlaceKey) => placeLabels?.[k] ?? (k in LANDMARKS ? LANDMARKS[k as keyof typeof LANDMARKS].name : k);

  // movers live in a ref; a tick counter re-renders the people layer only
  const movers = useRef<Map<string, Mover>>(new Map());
  const [, setTick] = useState(0);
  const [now, setNow] = useState(0);

  // (re)seat residents: spread them over the graph, deterministic per index
  const seated = useMemo(() => residents.map((r) => r.id).join(","), [residents]);
  useEffect(() => {
    const rand = rng(residents.length * 7 + 1);
    const next = new Map<string, Mover>();
    residents.forEach((r, i) => {
      const old = movers.current.get(r.id);
      if (old) return next.set(r.id, old);
      // start at their own spot (or spread over the graph when they have none)
      const from = r.spot ? SPOT_NODE[r.spot] : NODE_KEYS[(i * 5) % NODE_KEYS.length];
      const ox = ((i * 7) % 9) - 4;
      const oy = ((i * 5) % 5) - 2;
      const [x, y] = NODES[from];
      const to = NEIGHBORS[from][Math.floor(rand() * NEIGHBORS[from].length)];
      next.set(r.id, {
        ...(from === "camp" ? { x: campSeat(i)[0], y: campSeat(i)[1] } : { x: x + ox, y: y + oy }),
        seat: i,
        from,
        to,
        dir: "down",
        pauseUntil: performance.now() + rand() * 4000,
        ox,
        oy,
      });
    });
    movers.current = next;
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seated]);

  // where each resident is heading (read by the movement loop)
  const spots = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const next = new Map<string, string>();
    for (const r of residents) if (r.spot) next.set(r.id, SPOT_NODE[r.spot]);
    spots.current = next;
  }, [residents]);

  // movement loop
  useEffect(() => {
    if (reduced) return;
    const rand = rng(99);
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      for (const [id, m] of movers.current) {
        if (t < m.pauseUntil) continue;
        const [tx, ty] = targetOf(m);
        const dx = tx - m.x;
        const dy = ty - m.y;
        const dist = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (dist <= step) {
          m.x = tx;
          m.y = ty;
          const here = m.to;
          const home = spots.current.get(id);
          const options = NEIGHBORS[here].filter((n) => n !== m.from);
          const pool = options.length ? options : NEIGHBORS[here];
          m.from = here;
          if (home && here === home) {
            // at their spot: stay a good while, then take a short stroll
            m.to = pool[Math.floor(rand() * pool.length)];
            m.pauseUntil = t + 5000 + rand() * 9000;
            m.dir = "down";
          } else if (home && rand() < HOMING) {
            // head for their spot by the shortest way
            m.to = NEIGHBORS[here].reduce((best, n) => (STEPS[n][home] < STEPS[best][home] ? n : best), NEIGHBORS[here][0]);
          } else {
            m.to = pool[Math.floor(rand() * pool.length)];
            if (rand() < 0.45) {
              m.pauseUntil = t + 1200 + rand() * 4000;
              m.dir = rand() < 0.6 ? "down" : m.dir;
            }
          }
        } else {
          m.x += (dx / dist) * step;
          m.y += (dy / dist) * step;
          m.dir = directionOf(dx, dy);
        }
      }
      setNow(t);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // start the camera between the pool and the temple (after layout)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = scroller.current;
      if (!el) return;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.5;
      el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.45;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // depth sort: scenery + people by feet line
  const people = residents
    .map((r) => {
      const m = movers.current.get(r.id);
      if (!m) return null;
      const walking = !reduced && now >= m.pauseUntil;
      const frame = walking ? WALK_CYCLE[Math.floor(now / STEP_MS) % WALK_CYCLE.length] : 0;
      const frames = WALKERS[r.avatar as AvatarKey];
      if (!frames) return null;
      // snap to the walker pixel grid so sprites stay crisp
      const px = Math.round((m.x - (WALKER_W * SCALE) / 2) / SCALE) * SCALE;
      const py = Math.round((m.y - WALKER_H * SCALE) / SCALE) * SCALE;
      return { r, m, sprite: frames[m.dir][frame], px, py, feet: m.y };
    })
    .filter(Boolean) as { r: Resident; m: Mover; sprite: PlacedSprite["s"]; px: number; py: number; feet: number }[];

  const dark = darkness(hour);
  const fireFrames = fire !== undefined && fire < 0.35 ? MAP_FIRE_LOW : MAP_FIRE;
  const fireSprite = fireFrames[reduced ? 0 : Math.floor(now / 220) % fireFrames.length];
  // the glow breathes a little, and shrinks with the fire
  const glow = (fire === undefined ? 0 : 10 + 14 * fire) + (reduced ? 0 : Math.sin(now / 300) * 0.8);

  type Layer = { feet: number; key: string; node: React.ReactNode };
  const layers: Layer[] = [
    ...items.map((it, i) => ({
      feet: footY(it),
      key: `s${i}`,
      node: <Scenery key={`s${i}`} item={it} label={it.place && labelOf(it.place)} onPick={pickPlace} />,
    })),
    ...people.map((p) => ({
      feet: p.feet,
      key: `p${p.r.id}`,
      node: (
        <g
          key={`p${p.r.id}`}
          transform={`translate(${p.px} ${p.py}) scale(${SCALE})`}
          data-pick="person"
          onClick={() => { setSelected((s) => (s === p.r.id ? null : p.r.id)); pickPlace(null); }}
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={p.r.name}
        >
          <ellipse cx={WALKER_W / 2} cy={WALKER_H - 0.5} rx={5} ry={1.5} fill="#00000030" />
          <SpriteRects sprite={p.sprite} />
          {p.r.id === highlightId && (
            <polygon points={`${WALKER_W / 2 - 2},-4 ${WALKER_W / 2 + 2},-4 ${WALKER_W / 2},-1`} fill="#f0566a" />
          )}
        </g>
      ),
    })),
    ...(fire === undefined
      ? []
      : [{
          feet: FIRE_SPOT.y,
          key: "fire",
          node: (
            <g
              key="fire"
              data-pick="fire"
              transform={`translate(${FIRE_SPOT.x - (fireSprite.rows[0].length * SCALE) / 2} ${FIRE_SPOT.y - fireSprite.rows.length * SCALE}) scale(${SCALE})`}
              onClick={onFire}
              style={{ cursor: onFire ? "pointer" : undefined }}
              role="button"
              aria-label="Fogueira"
            >
              <SpriteRects sprite={fireSprite} />
            </g>
          ),
        }]),
  ].sort((a, b) => a.feet - b.feet);

  const sel = selected ? people.find((p) => p.r.id === selected) : null;
  // bubble anchor for the picked building: the first item of that place
  // (a construction site gets the pin too)
  const pickedItem = place ? items.find((it) => it.place === place) : null;
  const pickedSize = pickedItem ? spriteSize(pickedItem.s) : null;

  return (
    <div className="farm-scene" ref={scroller}>
      <div className="farm-scene-inner" style={{ width: `${zoom * 100}%` }}>
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label="Mapa do sítio com os moradores"
          onClick={(e) => {
            if ((e.target as Element).closest?.("[data-pick]")) return;
            setSelected(null);
            pickPlace(null);
          }}
        >
          <defs>
            <radialGradient id="farm-fire-glow">
              <stop offset="0" stopColor="#ffb35c" stopOpacity={0.6} />
              <stop offset="1" stopColor="#ffb35c" stopOpacity={0} />
            </radialGradient>
          </defs>
          <Ground />
          {layers.map((l) => l.node)}
          {dark > 0 && <rect width={MAP_W} height={MAP_H} fill="#0b1030" opacity={dark} pointerEvents="none" />}
          {fire !== undefined && fire > 0 && (
            <circle
              cx={FIRE_SPOT.x}
              cy={FIRE_SPOT.y - 3}
              r={glow}
              fill="url(#farm-fire-glow)"
              opacity={0.35 + (dark / MAX_DARKNESS) * 0.65}
              style={{ mixBlendMode: "screen" }}
              pointerEvents="none"
            />
          )}
          {showGraph && (
            <g opacity={0.8}>
              {EDGES.map(([a, b]) => (
                <line key={a + b} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="#f0566a" strokeWidth={0.5} />
              ))}
              {NODE_KEYS.map((k) => <circle key={k} cx={NODES[k][0]} cy={NODES[k][1]} r={1} fill="#8e2d52" />)}
            </g>
          )}
        </svg>
        {pickedItem && pickedSize && (
          <div
            className={`farm-bubble ${pickedItem.y < 12 ? "below" : ""}`}
            style={{
              left: `${((pickedItem.x + pickedSize.w / 2) / MAP_W) * 100}%`,
              top: `${((pickedItem.y < 12 ? pickedItem.y + pickedSize.h + 1 : pickedItem.y - 1) / MAP_H) * 100}%`,
            }}
            role="status"
          >
            <b>{labelOf(pickedItem.place!)}</b>
          </div>
        )}
        {sel && (
          <div
            className={`farm-bubble ${sel.py < 16 ? "below" : ""}`}
            style={{
              left: `${(sel.m.x / MAP_W) * 100}%`,
              top: `${((sel.py < 16 ? sel.m.y + 1 : sel.py - 1) / MAP_H) * 100}%`,
            }}
            role="status"
          >
            <b>{sel.r.name}</b>
            {sel.r.subtitle && <span>{sel.r.subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

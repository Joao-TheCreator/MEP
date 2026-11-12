"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GROUND, LANDMARKS, MAP_H, MAP_W, farmItems, footY, type PlaceKey, type PlacedSprite } from "./FarmMap";
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
};

const EDGES: [string, string][] = [
  ["field1", "field2"], ["field2", "field3"], ["field3", "fieldGate"], ["fieldGate", "poolLeft"],
  ["poolLeft", "patioW"], ["patioW", "patioMid"], ["patioMid", "patioE"],
  ["patioW", "pathTop"], ["poolLeft", "wellFront"], ["wellFront", "pathTop"],
  ["pathTop", "pathMid"], ["pathMid", "crossing"], ["crossing", "road"], ["road", "barnFront"],
  ["road", "houseA"], ["crossing", "templeW"], ["templeW", "templeDoor"],
  ["patioE", "eastLawn"], ["eastLawn", "annexFront"],
];

const NEIGHBORS: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (NEIGHBORS[a] ??= []).push(b);
  (NEIGHBORS[b] ??= []).push(a);
}
const NODE_KEYS = Object.keys(NODES);

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
}

interface Mover {
  x: number;
  y: number;
  from: string;
  to: string;
  dir: Direction;
  pauseUntil: number;
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
      const from = NODE_KEYS[(i * 5) % NODE_KEYS.length];
      const [x, y] = NODES[from];
      const to = NEIGHBORS[from][Math.floor(rand() * NEIGHBORS[from].length)];
      next.set(r.id, {
        x: x + ((i % 3) - 1) * 2,
        y,
        from,
        to,
        dir: "down",
        pauseUntil: performance.now() + rand() * 4000,
      });
    });
    movers.current = next;
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seated]);

  // movement loop
  useEffect(() => {
    if (reduced) return;
    const rand = rng(99);
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      for (const m of movers.current.values()) {
        if (t < m.pauseUntil) continue;
        const [tx, ty] = NODES[m.to];
        const dx = tx - m.x;
        const dy = ty - m.y;
        const dist = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (dist <= step) {
          m.x = tx;
          m.y = ty;
          const options = NEIGHBORS[m.to].filter((n) => n !== m.from);
          const pool = options.length ? options : NEIGHBORS[m.to];
          m.from = m.to;
          m.to = pool[Math.floor(rand() * pool.length)];
          if (rand() < 0.45) {
            m.pauseUntil = t + 1200 + rand() * 4000;
            m.dir = rand() < 0.6 ? "down" : m.dir;
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
          <Ground />
          {layers.map((l) => l.node)}
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

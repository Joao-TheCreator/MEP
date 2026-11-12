"use client";

import { useEffect, useRef, useState } from "react";
import { spriteRuns, spriteSize, type SpriteDef } from "@/art/pixel";
import { C } from "@/art/palette";
import { rng } from "@/art/grid";
import { LOGO, MILL, PALM, RESOURCE_SPRITES, TREE, TREE_DARK } from "@/art/sprites";
import { GROUND, MAP_H, MAP_W, farmItems, footY, type PlacedSprite } from "@/art/FarmMap";
import { WALKERS, WALKER_H, type Direction } from "@/art/walker";
import type { AvatarKey } from "@/art/avatars";
import {
  ASSOMBRACAO, CAMPFIRE, MATTRESS, ORB, SOMBRA, SPIKE_BALL, TENT, VOLLEYBALL, VULTO,
} from "@/prototype/night/sprites";
import { ARMORS, COIN_T, FIRE_LOGS, GUITAR, HEART, LADLE, LANTERN, NOTE, SWORDS, TIERS } from "./sprites";
import {
  CAPTIONS, FIRE_OUT, INSERT_AT, INSERT_LEN, NEW_BEATS, NEW_CAPTIONS, NIGHTS, TRAILER_DURATION, TRAILER_FPS, TRAILER_H, TRAILER_W,
} from "./timeline";

/**
 * Announcement trailer, drawn on a 1080×1920 canvas as a pure function of
 * time. `window.__setTrailerTime(t)` draws frame t (used by
 * scripts/render-trailer.mjs); without `?capture` it just plays in a loop.
 * Nothing here touches the game state or the server.
 */

const W = TRAILER_W;
const H = TRAILER_H;
type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- math
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => 0.5 - Math.cos(Math.PI * clamp01(k)) / 2;
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** 0 → 1 → 0 window with fades of `f` seconds. */
const win = (t: number, a: number, b: number, f = 0.3) => Math.min(span(t, a, a + f), 1 - span(t, b - f, b));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------- sprites on canvas
const sizes = new Map<SpriteDef, { w: number; h: number }>();
const canvases = new Map<SpriteDef, HTMLCanvasElement>();
const whites = new Map<SpriteDef, HTMLCanvasElement>();

function size(s: SpriteDef) {
  let v = sizes.get(s);
  if (!v) sizes.set(s, (v = spriteSize(s)));
  return v;
}

function spriteCanvas(s: SpriteDef) {
  let c = canvases.get(s);
  if (!c) {
    const { w, h } = size(s);
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d")!;
    for (const r of spriteRuns(s)) {
      x.fillStyle = r.fill;
      x.fillRect(r.x, r.y, r.w, 1);
    }
    canvases.set(s, c);
  }
  return c;
}

function whiteCanvas(s: SpriteDef) {
  let c = whites.get(s);
  if (!c) {
    const base = spriteCanvas(s);
    c = document.createElement("canvas");
    c.width = base.width;
    c.height = base.height;
    const x = c.getContext("2d")!;
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, c.width, c.height);
    whites.set(s, c);
  }
  return c;
}

interface DrawOpts {
  flip?: boolean;
  alpha?: number;
  white?: number;
}

/** Sprite with its top-left at (x, y) screen px, each sprite pixel = `scale` px. */
function drawS(ctx: Ctx, s: SpriteDef, x: number, y: number, scale: number, o: DrawOpts = {}) {
  const { w, h } = size(s);
  const alpha = o.alpha ?? 1;
  if (alpha <= 0) return;
  x = Math.round(x);
  y = Math.round(y);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (o.flip) {
    ctx.translate(x + w * scale, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  ctx.drawImage(spriteCanvas(s), x, y, w * scale, h * scale);
  if (o.white && o.white > 0) {
    ctx.globalAlpha = alpha * Math.min(1, o.white);
    ctx.drawImage(whiteCanvas(s), x, y, w * scale, h * scale);
  }
  ctx.restore();
}

/** Sprite with its feet (bottom-center) at (fx, fy) screen px. */
function drawFeet(ctx: Ctx, s: SpriteDef, fx: number, fy: number, scale: number, o: DrawOpts = {}) {
  const { w, h } = size(s);
  drawS(ctx, s, fx - Math.round(w / 2) * scale, fy - h * scale, scale, o);
}

/** Keeps only the pixels drawn with `chars` (glowing eyes on top of the darkness). */
function only(s: SpriteDef, chars: string): SpriteDef {
  return {
    rows: s.rows.map((r) => [...r].map((ch) => (chars.includes(ch) ? ch : ".")).join("")),
    colors: s.colors,
  };
}
const SOMBRA_EYES = only(SOMBRA, "e");
const VULTO_EYES = only(VULTO, "r");

// ---------------------------------------------------------------- text
let FONT_DISPLAY = "monospace";

function wrap(ctx: Ctx, str: string, maxW: number) {
  const words = str.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

interface TextOpts {
  color?: string;
  stroke?: string;
  alpha?: number;
  weight?: number;
  maxW?: number;
  align?: CanvasTextAlign;
  lineHeight?: number;
  shadow?: string;
}

function text(ctx: Ctx, str: string, x: number, y: number, px: number, o: TextOpts = {}) {
  const alpha = o.alpha ?? 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${o.weight ?? 600} ${px}px ${FONT_DISPLAY}`;
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const lines = wrap(ctx, str, o.maxW ?? 960);
  const lh = px * (o.lineHeight ?? 1.12);
  lines.forEach((line, i) => {
    const ly = y + (i - (lines.length - 1) / 2) * lh;
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(line, x, ly + px * 0.1);
    }
    ctx.strokeStyle = o.stroke ?? C.ink;
    ctx.lineWidth = px * 0.2;
    ctx.strokeText(line, x, ly);
    ctx.fillStyle = o.color ?? C.paper;
    ctx.fillText(line, x, ly);
  });
  ctx.restore();
}

function radial(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number, op: GlobalCompositeOperation = "lighter") {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = op;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function vertical(ctx: Ctx, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Pixel embers rising (deterministic). */
function embers(ctx: Ctx, t: number, n: number, alpha: number, seed = 1) {
  for (let i = 0; i < n; i++) {
    const sp = 60 + hash(seed + i) * 120;
    const x = Math.round((hash(seed + i * 3.1) * W + Math.sin(t * 1.3 + i) * 30) / 6) * 6;
    const y = Math.round((H + 40 - ((t * sp + hash(seed + i * 7.7) * H) % (H + 80))) / 6) * 6;
    const s = hash(i + seed * 2) < 0.5 ? 6 : 12;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * hash(i * 9.1 + seed));
    ctx.fillStyle = i % 3 === 0 ? C.gold : i % 3 === 1 ? C.ember : C.flameLight;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

// ================================================================ 1. intro
function drawIntro(ctx: Ctx, t: number) {
  ctx.fillStyle = "#0b0608";
  ctx.fillRect(0, 0, W, H);
  const a = ease(span(t, 0.3, 1.6));
  radial(ctx, 540, 860, 520 + Math.sin(t * 5) * 14, "rgba(229,96,58,0.9)", 0.35 * a);
  embers(ctx, t, 26, a * 0.7, 3);
  const scale = 22;
  drawS(ctx, LOGO, 540 - 10 * scale, 860 - 10 * scale - Math.round((1 - a) * 4) * scale, scale, { alpha: a });
}

// ================================================================ 2. day on the farm
const DAY_S = 16; // screen px per map px
const DAY_ITEMS_BUILDING = farmItems(["well", "barn"], "mill");
const DAY_ITEMS_DONE = farmItems(["well", "barn", "mill"]);
const MILL_AT = DAY_ITEMS_DONE.find((it) => it.s === MILL)!;
const MILL_DONE = 9.4;
const WALK_CYCLE = [1, 0, 2, 0];

type Pt = [number, number];
interface DayWalker {
  avatar: AvatarKey;
  path: Pt[];
  phase: number;
  idle?: Direction;
}

const DAY_WALKERS: DayWalker[] = [
  { avatar: "joao-pedro", path: [[14, 14], [30, 20], [46, 24]], phase: 3 },
  { avatar: "drielly", path: [[30, 20], [46, 24], [54, 32], [60, 42]], phase: 20 },
  { avatar: "sofia", path: [[22, 10]], phase: 0, idle: "down" },
  { avatar: "hernnane", path: [[66, 50], [80, 50], [94, 50]], phase: 5 },
  { avatar: "heloisa", path: [[94, 50], [80, 50], [66, 50]], phase: 14 },
  { avatar: "diego", path: [[84, 49]], phase: 0, idle: "down" },
  { avatar: "samuel", path: [[60, 56], [60, 68], [60, 82]], phase: 8 },
  { avatar: "alessandra", path: [[60, 82], [42, 82], [28, 82]], phase: 2 },
  { avatar: "sarah", path: [[52, 54], [60, 56], [60, 68]], phase: 11 },
  { avatar: "samuel-choi", path: [[72, 87], [92, 87]], phase: 0 },
  { avatar: "alex", path: [[94, 50], [110, 46], [132, 42]], phase: 9 },
  { avatar: "nathan", path: [[132, 42], [110, 46]], phase: 4 },
  { avatar: "carol", path: [[142, 40]], phase: 0, idle: "left" },
  { avatar: "idro", path: [[104, 56], [118, 58], [130, 56]], phase: 6 },
  { avatar: "suzana", path: [[38, 87]], phase: 0, idle: "down" },
  { avatar: "rodrigo", path: [[46, 79], [42, 82], [28, 82]], phase: 17 },
];

function dirOf(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function dayWalkerAt(w: DayWalker, t: number) {
  if (w.idle || w.path.length < 2) {
    const [x, y] = w.path[0];
    return { x, y, dir: w.idle ?? "down", frame: 0 };
  }
  const segs = w.path.slice(1).map((p, i) => {
    const a = w.path[i];
    return { a, b: p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  let d = (w.phase + t * 7) % (2 * total);
  const back = d > total;
  if (back) d = 2 * total - d;
  for (const s of segs) {
    if (d <= s.len || s === segs[segs.length - 1]) {
      const k = Math.min(1, d / s.len);
      const dx = s.b[0] - s.a[0];
      const dy = s.b[1] - s.a[1];
      return {
        x: s.a[0] + dx * k,
        y: s.a[1] + dy * k,
        dir: dirOf(back ? -dx : dx, back ? -dy : dy),
        frame: WALK_CYCLE[Math.floor(t / 0.16) % 4],
      };
    }
    d -= s.len;
  }
  return { x: w.path[0][0], y: w.path[0][1], dir: "down" as Direction, frame: 0 };
}

const POP_ICONS = ["grain", "wood", "milk", "ore", "cheese", "plank", "feed", "tool"]
  .map((k) => RESOURCE_SPRITES[k])
  .filter(Boolean);

function dayCamOffset(t: number) {
  const camX = ease(span(t, 4.1, 11)) * (MAP_W - W / DAY_S);
  return Math.round(camX * DAY_S);
}

function walkerScreen(w: DayWalker, t: number) {
  const p = dayWalkerAt(w, t);
  return { ...p, sx: Math.round(p.x * DAY_S) - dayCamOffset(t), sy: Math.round(p.y * DAY_S) };
}

function drawDay(ctx: Ctx, t: number) {
  const off = dayCamOffset(t);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas(GROUND), -off, 0, MAP_W * DAY_S, MAP_H * DAY_S);

  const items = t < MILL_DONE ? DAY_ITEMS_BUILDING : DAY_ITEMS_DONE;
  type Layer = { feet: number; draw: () => void };
  const layers: Layer[] = [];
  for (const it of items) {
    const sx = it.x * DAY_S - off;
    if (sx > W || sx + size(it.s).w * DAY_S < 0) continue;
    layers.push({ feet: footY(it), draw: () => drawS(ctx, it.s, sx, it.y * DAY_S, DAY_S) });
  }
  for (const w of DAY_WALKERS) {
    const p = walkerScreen(w, t);
    if (p.sx < -200 || p.sx > W + 200) continue;
    layers.push({
      feet: p.y,
      draw: () => {
        ctx.fillStyle = "#00000030";
        ctx.fillRect(p.sx - 40, p.sy - 8, 80, 8);
        ctx.fillRect(p.sx - 32, p.sy - 12, 64, 12);
        drawFeet(ctx, WALKERS[w.avatar][p.dir][p.frame], p.sx, p.sy, DAY_S / 2);
      },
    });
  }
  layers.sort((a, b) => a.feet - b.feet).forEach((l) => l.draw());

  // the mill finishing: dust puff
  if (t >= MILL_DONE && t < MILL_DONE + 0.9) {
    const k = span(t, MILL_DONE, MILL_DONE + 0.9);
    const { w, h } = size(MILL);
    const cx = (MILL_AT.x + w / 2) * DAY_S - off;
    const cy = (MILL_AT.y + h - 3) * DAY_S;
    ctx.fillStyle = C.milk;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = 40 + ease(k) * 180;
      ctx.globalAlpha = 1 - k;
      const s = i % 2 ? 32 : 48;
      ctx.fillRect(Math.round((cx + Math.cos(ang) * r) / 16) * 16, Math.round((cy + Math.sin(ang) * r * 0.5) / 16) * 16, s, s);
    }
    ctx.globalAlpha = 1;
  }
  if (t >= MILL_DONE && t < MILL_DONE + 1.6) {
    const { w, h } = size(MILL);
    const cx = (MILL_AT.x + w / 2) * DAY_S - off;
    const cy = (MILL_AT.y + h - 3) * DAY_S;
    const k = ease(span(t, MILL_DONE, MILL_DONE + 0.5));
    text(ctx, "Moinho pronto!", cx, cy - h * DAY_S - 40 - k * 40, 56, { color: C.gold, alpha: win(t, MILL_DONE, MILL_DONE + 1.6, 0.2) });
  }

  // resources popping over residents (collect / craft)
  for (let j = 0; j < 9; j++) {
    const t0 = 7.9 + j * 0.36;
    if (t < t0 || t > t0 + 1.2) continue;
    let pick: DayWalker | null = null;
    for (let k = 0; k < DAY_WALKERS.length; k++) {
      const w = DAY_WALKERS[(j * 5 + k) % DAY_WALKERS.length];
      const p = walkerScreen(w, t0);
      if (p.sx > 140 && p.sx < W - 140 && p.sy > 420) {
        pick = w;
        break;
      }
    }
    if (!pick) continue;
    const p = walkerScreen(pick, t0);
    const k = span(t, t0, t0 + 1.2);
    const icon = POP_ICONS[j % POP_ICONS.length];
    const a = 1 - span(t, t0 + 0.8, t0 + 1.2);
    const top = p.sy - WALKER_H * 8 - 40 - Math.round((ease(k) * 100) / 8) * 8;
    const { w: iw, h: ih } = size(icon);
    drawS(ctx, icon, p.sx - iw * 4 - 30, top - ih * 8, 8, { alpha: a });
    text(ctx, "+1", p.sx + iw * 4 + 10, top - ih * 4, 60, { color: C.gold, alpha: a });
  }
}

// ================================================================ 3. forge
function drawForge(ctx: Ctx, t: number) {
  const local = t - 11;
  vertical(ctx, "#3a1424", "#12080d");
  embers(ctx, t, 30, 0.6, 9);
  const tier = Math.min(3, Math.floor(local / 0.8));
  const since = local - tier * 0.8;
  const tc = TIERS[tier];
  const flash = 1 - span(since, 0, 0.3);
  const bump = since < 0.12 ? 2 : 0;

  radial(ctx, 300, 720, 330, tc.l, 0.28);
  radial(ctx, 800, 720, 330, tc.l, 0.28);
  const ss = 26 + bump;
  drawS(ctx, SWORDS[tier], 300 - 8 * ss, 720 - 8 * ss, ss, { white: flash * 0.8 });
  const as = 28 + bump;
  drawS(ctx, ARMORS[tier], 800 - 7 * as, 720 - Math.round(6.5 * as), as, { white: flash * 0.8 });

  // sparks
  const r = rng(tier * 31 + 5);
  for (let i = 0; i < 18; i++) {
    const ang = r() * Math.PI * 2;
    const sp = 300 + r() * 600;
    const x = 550 + Math.cos(ang) * sp * since;
    const y = 720 + Math.sin(ang) * sp * since + 900 * since * since;
    ctx.globalAlpha = 1 - span(since, 0, 0.7);
    ctx.fillStyle = i % 2 ? C.gold : tc.l;
    ctx.fillRect(Math.round(x / 8) * 8, Math.round(y / 8) * 8, 16, 16);
  }
  ctx.globalAlpha = 1;

  text(ctx, tc.name.toUpperCase(), 540, 1140, 120, { color: tc.l, stroke: "#12080d", alpha: 1 });
  for (let i = 0; i < 4; i++) {
    const x = 540 + (i - 1.5) * 150;
    ctx.fillStyle = i <= tier ? TIERS[i].b : "#ffffff18";
    ctx.fillRect(x - 32, 1268, 64, 64);
    ctx.fillStyle = i <= tier ? TIERS[i].l : "#ffffff10";
    ctx.fillRect(x - 32, 1268, 64, 12);
    if (i < 3) {
      ctx.fillStyle = i < tier ? C.gold : "#ffffff22";
      ctx.fillRect(x + 44, 1294, 62, 12);
    }
  }
}

// ================================================================ 4. skill tree
const SKILL_NODES: { x: number; y: number; parent: number; at: number; icon: SpriteDef; scale: number }[] = [
  { x: 540, y: 1000, parent: -1, at: 0, icon: VOLLEYBALL, scale: 10 },
  { x: 330, y: 1170, parent: 0, at: 0.55, icon: SPIKE_BALL, scale: 10 },
  { x: 750, y: 1170, parent: 0, at: 1.05, icon: MATTRESS, scale: 6 },
  { x: 200, y: 1350, parent: 1, at: 1.55, icon: RESOURCE_SPRITES.tool ?? ORB, scale: 5 },
  { x: 440, y: 1350, parent: 1, at: 2.0, icon: VOLLEYBALL, scale: 10 },
  { x: 650, y: 1350, parent: 2, at: 2.4, icon: ORB, scale: 10 },
  { x: 880, y: 1350, parent: 2, at: 2.8, icon: SPIKE_BALL, scale: 10 },
];

function drawSkills(ctx: Ctx, t: number) {
  const local = t - 14.3;
  vertical(ctx, "#163020", "#08130c");
  ctx.fillStyle = "#ffffff08";
  for (let y = 0; y < H; y += 48) for (let x = (y / 48) % 2 ? 24 : 0; x < W; x += 48) ctx.fillRect(x, y, 6, 6);

  const unlocked = SKILL_NODES.filter((n) => local >= n.at).length;
  const lastAt = SKILL_NODES[unlocked - 1]?.at ?? 0;
  const pulse = 1 - span(local, lastAt, lastAt + 0.4);

  // hero on top
  radial(ctx, 540, 600, 300, "rgba(240,178,60,0.9)", 0.25 + 0.3 * pulse);
  const hero = WALKERS.samuel.down[0];
  drawFeet(ctx, hero, 540, 700, 14, { white: pulse * 0.5 });
  drawFeet(ctx, VOLLEYBALL, 540 + 150, 520 + Math.round(Math.abs(Math.sin(local * 5)) * -6) * 8, 10);
  text(ctx, "Jogador de vôlei", 540, 760, 54, { color: C.gold });
  text(ctx, `Nível ${7 + unlocked}`, 540, 850, 64, { color: C.paper, stroke: C.wineDark });

  // "+1 nível" pops
  for (const n of SKILL_NODES.slice(1)) {
    const k = span(local, n.at, n.at + 1);
    if (k <= 0 || k >= 1) continue;
    text(ctx, "+1 nível", 790, 380 - ease(k) * 120, 64, { color: "#8fe07a", alpha: 1 - span(k, 0.6, 1) });
  }

  // edges then nodes
  for (const n of SKILL_NODES) {
    if (n.parent < 0) continue;
    const p = SKILL_NODES[n.parent];
    const k = span(local, n.at - 0.25, n.at);
    ctx.strokeStyle = "#2d4a35";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(n.x, n.y);
    ctx.stroke();
    if (k > 0) {
      ctx.strokeStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(lerp(p.x, n.x, k), lerp(p.y, n.y, k));
      ctx.stroke();
    }
  }
  for (const n of SKILL_NODES) {
    const on = local >= n.at;
    const fl = on ? 1 - span(local, n.at, n.at + 0.35) : 0;
    const s = 128 + Math.round(fl * 2) * 8;
    ctx.fillStyle = on ? C.gold : "#2d4a35";
    ctx.fillRect(n.x - s / 2 - 8, n.y - s / 2 - 8, s + 16, s + 16);
    ctx.fillStyle = on ? C.wine : "#1a2e21";
    ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s);
    const { w, h } = size(n.icon);
    drawS(ctx, n.icon, n.x - (w * n.scale) / 2, n.y - (h * n.scale) / 2, n.scale, { alpha: on ? 1 : 0.25, white: fl });
  }
}

// ================================================================ 5–6. camp at sunset and night
const A = 8; // screen px per arena px
const AW = W / A; // 135
const AH = H / A; // 240
const FIRE = { x: 67, y: 150 };

function buildArena() {
  const c = document.createElement("canvas");
  c.width = AW;
  c.height = AH;
  const x = c.getContext("2d")!;
  const r = rng(77);
  x.fillStyle = C.grass;
  x.fillRect(0, 0, AW, AH);
  for (let y = 0; y < AH; y++)
    for (let i = 0; i < AW; i++) {
      const v = r();
      const dx = (i - FIRE.x) / 34;
      const dy = (y - FIRE.y - 6) / 24;
      const inClear = dx * dx + dy * dy < 1;
      if (inClear) {
        x.fillStyle = v < 0.12 ? C.dirtDark : v < 0.2 ? "#c7a477" : C.dirt;
        x.fillRect(i, y, 1, 1);
      } else if (v < 0.1) {
        x.fillStyle = C.grassDark;
        x.fillRect(i, y, 1, 1);
      } else if (v < 0.16) {
        x.fillStyle = C.grassLight;
        x.fillRect(i, y, 1, 1);
      }
    }
  // path to the south
  for (let y = FIRE.y + 22; y < AH; y++)
    for (let i = 0; i < 8; i++) {
      x.fillStyle = r() < 0.15 ? C.dirtDark : C.dirt;
      x.fillRect(FIRE.x - 4 + i + Math.round(Math.sin(y / 9) * 3), y, 1, 1);
    }
  // woods: dense at the top, along the sides
  const trees: PlacedSprite[] = [];
  for (let y = -8; y < 60; y += 6)
    for (let i = -8; i < AW; i += 8) {
      const s = r() < 0.15 ? PALM : r() < 0.6 ? TREE_DARK : TREE;
      trees.push({ s, x: i + Math.floor(r() * 5), y: y + Math.floor(r() * 3) });
    }
  for (let y = 60; y < 214; y += 9) {
    trees.push({ s: r() < 0.6 ? TREE_DARK : TREE, x: -6 + Math.floor(r() * 4), y });
    if (r() < 0.6) trees.push({ s: TREE_DARK, x: 3 + Math.floor(r() * 4), y: y + 4 });
    trees.push({ s: r() < 0.6 ? TREE_DARK : PALM, x: AW - 8 - Math.floor(r() * 4), y: y + 3 });
    if (r() < 0.6) trees.push({ s: TREE_DARK, x: AW - 16 - Math.floor(r() * 4), y: y + 7 });
  }
  trees.push({ s: TENT, x: 18, y: 120 }, { s: TENT, x: 100, y: 126 });
  trees.sort((a, b) => footY(a) - footY(b));
  for (const t of trees) x.drawImage(spriteCanvas(t.s), t.x, t.y);
  return c;
}

type Kind = "sombra" | "vulto" | "assombracao";
const KIND_SPRITE: Record<Kind, SpriteDef> = { sombra: SOMBRA, vulto: VULTO, assombracao: ASSOMBRACAO };

interface Hero {
  avatar: AvatarKey;
  cls: "volei" | "colchonete";
  x: number;
  y: number;
  face: 1 | -1;
}
const HEROES: Hero[] = [
  { avatar: "samuel", cls: "volei", x: 44, y: 172, face: 1 },
  { avatar: "sarah", cls: "volei", x: 94, y: 176, face: -1 },
  { avatar: "gabriel-campos", cls: "colchonete", x: 84, y: 140, face: 1 },
];
const SITTERS: { avatar: AvatarKey; x: number; y: number; dir: Direction }[] = [
  { avatar: "diego", x: 58, y: 198, dir: "up" },
  { avatar: "drielly", x: 78, y: 200, dir: "up" },
  { avatar: "heloisa", x: 40, y: 152, dir: "right" },
];

interface Monster {
  id: number;
  night: number;
  kind: Kind;
  scale: number;
  t0: number;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  tArr: number;
  tDie: number | null;
  killer: number;
  dmg: number;
}

function buildMonsters(): Monster[] {
  const out: Monster[] = [];
  let id = 0;
  for (const seg of NIGHTS) {
    const r = rng(seg.seed);
    const spread = Math.min(2.4, seg.to - seg.from - 0.6);
    const add = (m: Omit<Monster, "id" | "night" | "tArr" | "tDie" | "killer" | "dmg">, killChance: number) => {
      const speed = m.scale > A ? 9 : m.kind === "vulto" ? 42 : m.kind === "sombra" ? 22 : 26;
      let { dx, dy } = m;
      let killer = -1;
      let tDie: number | null = null;
      if (r() < killChance) {
        const colch = HEROES[2];
        if (dx > FIRE.x + 4 && dy < FIRE.y + 4) {
          killer = 2;
          const len = Math.hypot(m.sx - colch.x, m.sy - colch.y);
          dx = colch.x + ((m.sx - colch.x) / len) * 14;
          dy = colch.y + ((m.sy - colch.y) / len) * 10;
        } else killer = dx < FIRE.x ? 0 : 1;
      }
      const tArr = m.t0 + Math.hypot(dx - m.sx, dy - m.sy) / speed;
      if (killer >= 0) {
        tDie = killer === 2 ? tArr + 0.2 : m.t0 + 0.5 + (tArr - m.t0) * (0.4 + r() * 0.5);
        if (tDie > Math.min(seg.to, FIRE_OUT) - 0.2) {
          tDie = null;
          killer = -1;
        }
      }
      const base = seg.n === 1 ? 8 : seg.n === 7 ? 45 : 190;
      out.push({ ...m, dx, dy, id: id++, night: seg.n, tArr, tDie, killer, dmg: Math.round(base * (1 + r() * 0.8)) });
    };
    for (let i = 0; i < seg.count; i++) {
      const v = r();
      const kind: Kind = v < 0.45 ? "sombra" : v < 0.75 ? "vulto" : "assombracao";
      const t0 = seg.from + 0.1 + (i / seg.count) * spread + r() * 0.2;
      const side = r();
      let sx: number;
      let sy: number;
      if (side < 0.6) {
        sx = 10 + r() * (AW - 20);
        sy = 54 + r() * 12;
      } else {
        sx = side < 0.8 ? -10 : AW + 10;
        sy = 80 + r() * 90;
      }
      const ang = Math.atan2(sy - FIRE.y, sx - FIRE.x);
      const rad = 30 + r() * 20;
      const dx = FIRE.x + Math.cos(ang) * rad;
      const dy = Math.min(FIRE.y + 30, FIRE.y + Math.sin(ang) * rad * 0.8);
      add({ kind, scale: A, t0, sx, sy, dx, dy }, seg.n === 23 ? 0.35 : 0.7);
    }
    if (seg.n === 23) {
      add({ kind: "sombra", scale: A * 2, t0: seg.from + 0.2, sx: 36, sy: 64, dx: 42, dy: 112 }, 0);
      add({ kind: "sombra", scale: A * 2, t0: seg.from + 0.7, sx: 102, sy: 62, dx: 96, dy: 110 }, 0);
    }
  }
  return out;
}
const MONSTERS = buildMonsters();

function nightAt(t: number) {
  return NIGHTS.find((n) => t >= n.from && t < n.to) ?? null;
}

function monsterPos(m: Monster, t: number) {
  const k = clamp01((t - m.t0) / (m.tArr - m.t0));
  let x = lerp(m.sx, m.dx, k);
  let y = lerp(m.sy, m.dy, k);
  if (m.night === 23) {
    const p = ease(span(t, 30.4, FIRE_OUT)) * 0.5 * k;
    x = lerp(x, FIRE.x, p);
    y = lerp(y, FIRE.y, p);
  }
  if (m.kind === "assombracao") y -= 3 + Math.sin(t * 4 + m.id);
  if (k >= 1 && m.kind === "sombra") y -= Math.abs(Math.sin(t * 6 + m.id)) * 1.5;
  return { x, y, arrived: k >= 1, movingRight: m.dx > m.sx };
}

function fireLevel(t: number) {
  if (t < 19.6) return 0;
  if (t >= FIRE_OUT) return 0;
  const lit = span(t, 19.6, 20.1);
  const dying = 1 - ease(span(t, 30.2, FIRE_OUT)) * 0.85;
  return lit * dying;
}

function drawArena(ctx: Ctx, t: number, arena: HTMLCanvasElement, dark: HTMLCanvasElement) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(arena, 0, 0, W, H);
  const seg = t >= 22 ? nightAt(t) : null;
  const monsters = seg ? MONSTERS.filter((m) => m.night === seg.n && t >= m.t0 && (m.tDie === null || t < m.tDie + 0.35)) : [];
  const fl = fireLevel(t);
  const heroesDown = t > FIRE_OUT - 0.6;

  type Layer = { feet: number; draw: () => void };
  const layers: Layer[] = [];
  const flash = (at: number | null) => (at === null ? 0 : 1 - span(t, at, at + 0.35));

  for (const m of monsters) {
    const p = monsterPos(m, t);
    const sprite = KIND_SPRITE[m.kind];
    const dying = m.tDie !== null && t >= m.tDie;
    const alpha = span(t, m.t0, m.t0 + 0.4) * (dying ? 1 - span(t, m.tDie!, m.tDie! + 0.35) : 1);
    const flip = p.arrived ? FIRE.x > p.x : p.movingRight;
    layers.push({
      feet: p.y,
      draw: () => {
        ctx.fillStyle = "#00000040";
        ctx.fillRect(Math.round(p.x * A) - 3 * m.scale, Math.round(p.y * A) - 4, 6 * m.scale, 6);
        if (m.scale > A) radial(ctx, p.x * A, p.y * A - 7 * m.scale, 9 * m.scale, "rgba(222,74,71,0.9)", 0.35 + 0.1 * Math.sin(t * 8), "source-over");
        drawFeet(ctx, sprite, Math.round(p.x) * A, Math.round(p.y) * A, m.scale, { flip, alpha, white: dying ? 1 : 0 });
      },
    });
  }

  // heroes
  HEROES.forEach((h, hi) => {
    const next = monsters
      .filter((m) => m.killer === hi && m.tDie !== null && m.tDie >= t - 0.1)
      .sort((a, b) => a.tDie! - b.tDie!)[0];
    const face = next ? (monsterPos(next, t).x >= h.x ? 1 : -1) : h.face;
    const threw = monsters.some((m) => m.killer === hi && m.tDie !== null && t >= m.tDie - 0.4 && t < m.tDie - 0.2);
    const swing = h.cls === "colchonete" && next && t >= next.tDie! - 0.2;
    const sprite = WALKERS[h.avatar][face > 0 ? "right" : "left"][threw || swing ? 1 : 0];
    layers.push({
      feet: h.y,
      draw: () => {
        const sx = h.x * A;
        const sy = h.y * A;
        const alpha = heroesDown ? 0.5 : 1;
        ctx.fillStyle = "#00000040";
        ctx.fillRect(sx - 48, sy - 8, 96, 8);
        drawFeet(ctx, sprite, sx, sy, A, { alpha });
        if (h.cls === "colchonete") {
          const reach = swing ? 9 : 5;
          drawFeet(ctx, MATTRESS, sx + face * reach * A, sy - A, A, { alpha });
        } else if (!threw && t >= 20) {
          drawFeet(ctx, t >= 28 ? SPIKE_BALL : VOLLEYBALL, sx + face * 6 * A, sy - 6 * A, A, { alpha });
        }
      },
    });
  });
  if (t < 22) {
    for (const s of SITTERS) {
      const sp = WALKERS[s.avatar][s.dir][0];
      layers.push({ feet: s.y, draw: () => drawFeet(ctx, sp, s.x * A, s.y * A, A) });
    }
  }

  // campfire
  layers.push({
    feet: FIRE.y + 2,
    draw: () => {
      const dyingFlicker = t > 30.2 && hash(Math.floor(t * 12)) < span(t, 30.2, FIRE_OUT) * 0.6;
      const lit = fl > 0 && !dyingFlicker;
      const sprite = lit ? CAMPFIRE[Math.floor(t / 0.15) % 2] : FIRE_LOGS;
      drawFeet(ctx, sprite, FIRE.x * A, (FIRE.y + 2) * A, A * 2);
    },
  });

  layers.sort((a, b) => a.feet - b.feet).forEach((l) => l.draw());

  // projectiles
  for (const m of monsters) {
    if (m.tDie === null || m.killer > 1) continue;
    const t0 = m.tDie - 0.4;
    if (t < t0 || t >= m.tDie) continue;
    const h = HEROES[m.killer];
    const target = monsterPos(m, m.tDie);
    const k = span(t, t0, m.tDie);
    const face = target.x >= h.x ? 1 : -1;
    const x = lerp(h.x + face * 6, target.x, k);
    const y = lerp(h.y - 18, target.y - 7, k) - Math.sin(Math.PI * k) * 14;
    drawFeet(ctx, m.night === 23 ? SPIKE_BALL : VOLLEYBALL, Math.round(x) * A, Math.round(y) * A, A);
  }
  // ghost orbs blocked by the mattress
  const colch = HEROES[2];
  let shield = 0;
  for (const m of monsters) {
    if (m.kind !== "assombracao") continue;
    const end = Math.min(m.tDie ?? 99, FIRE_OUT);
    for (let j = 0; j < 4; j++) {
      const s0 = m.tArr + 0.2 + j * 1.3 + (m.id % 3) * 0.2;
      if (s0 >= end) break;
      const k = span(t, s0, s0 + 0.6);
      if (t >= s0 && k < 1) {
        const from = monsterPos(m, s0);
        drawFeet(ctx, ORB, Math.round(lerp(from.x, colch.x, k)) * A, Math.round(lerp(from.y - 8, colch.y - 10, k)) * A, A);
      }
      if (t >= s0 + 0.6) shield = Math.max(shield, 1 - span(t, s0 + 0.6, s0 + 0.9));
    }
  }
  if (shield > 0) {
    ctx.fillStyle = `rgba(111,158,230,${0.35 * shield})`;
    ctx.beginPath();
    ctx.arc(colch.x * A, (colch.y - 13) * A, 120, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- light: sunset tint, darkness with a hole around the fire, glow
  const warm = win(t, 17.6, 21.6, 1.4) * 0.45;
  if (warm > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgba(255,150,90,${warm})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  let dk = ease(span(t, 19.4, 21.8)) * 0.74;
  if (t >= FIRE_OUT) dk = lerp(0.74, 0.97, span(t, FIRE_OUT, FIRE_OUT + 0.3));
  if (dk > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgba(70,90,170,${dk * 0.9})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const d = dark.getContext("2d")!;
    d.globalCompositeOperation = "source-over";
    d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(4,6,20,${dk})`;
    d.fillRect(0, 0, W, H);
    const fx = FIRE.x * A;
    const fy = (FIRE.y - 4) * A;
    if (fl > 0) {
      const R = (430 + Math.sin(t * 9) * 14 + Math.sin(t * 23) * 8) * (0.55 + 0.45 * fl);
      d.globalCompositeOperation = "destination-out";
      const g = d.createRadialGradient(fx, fy, 0, fx, fy, R);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * fl})`);
      g.addColorStop(0.6, `rgba(0,0,0,${0.6 * fl})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = g;
      d.fillRect(0, 0, W, H);
    }
    ctx.drawImage(dark, 0, 0);
    radial(ctx, fx, fy, 380 * (0.6 + 0.4 * fl), "rgba(255,170,80,1)", 0.3 * fl);
    // glowing eyes stay visible in the dark
    for (const m of monsters) {
      if (m.kind === "assombracao") continue;
      const p = monsterPos(m, t);
      const dying = m.tDie !== null && t >= m.tDie;
      const flip = p.arrived ? FIRE.x > p.x : p.movingRight;
      drawFeet(ctx, m.kind === "sombra" ? SOMBRA_EYES : VULTO_EYES, Math.round(p.x) * A, Math.round(p.y) * A, m.scale, {
        flip,
        alpha: span(t, m.t0, m.t0 + 0.4) * (dying ? 0 : 0.9),
      });
    }
  }
  // fire lighting spark
  if (t >= 19.6 && t < 20.3) radial(ctx, FIRE.x * A, (FIRE.y - 4) * A, 300, "rgba(255,224,138,1)", 0.6 * (1 - span(t, 19.6, 20.3)));

  // smoke after it goes out
  if (t >= FIRE_OUT) {
    for (let i = 0; i < 8; i++) {
      const k = ((t - FIRE_OUT) * 0.9 + i / 8) % 1;
      ctx.fillStyle = `rgba(160,160,170,${0.5 * (1 - k)})`;
      const x = Math.round((FIRE.x * A + Math.sin(i * 2 + t * 3) * 30) / 8) * 8;
      const y = Math.round(((FIRE.y - 8) * A - k * 260) / 8) * 8;
      ctx.fillRect(x - 16, y - 16, 32 + (i % 2) * 16, 32);
    }
  }

  // kill feedback (drawn on top so it reads in the dark)
  for (const m of monsters) {
    if (m.tDie === null || t < m.tDie || t > m.tDie + 0.8) continue;
    const p = monsterPos(m, m.tDie);
    const k = span(t, m.tDie, m.tDie + 0.8);
    text(ctx, `-${m.dmg}`, p.x * A, p.y * A - 140 - k * 70, m.night === 23 ? 60 : 50, { color: "#ffe08a", alpha: 1 - span(k, 0.6, 1) });
    if (m.killer === 2) text(ctx, "POF!", p.x * A + 40, p.y * A - 60, 56, { color: "#6f9ee6", alpha: 1 - k, stroke: C.paper });
  }

  // fire bar
  if (seg && t < FIRE_OUT + 0.3) {
    const ratio = 1 - ease(span(t, 29.6, FIRE_OUT));
    const bx = FIRE.x * A - 96;
    const by = (FIRE.y + 6) * A;
    ctx.fillStyle = "#000000a0";
    ctx.fillRect(bx - 6, by - 6, 204, 28);
    ctx.fillStyle = ratio < 0.3 ? C.flame : "#ffb35c";
    ctx.fillRect(bx, by, Math.round((192 * ratio) / 8) * 8, 16);
  }

  // night counter
  if (seg && t < FIRE_OUT + 0.2) {
    const k = span(t, seg.from, seg.from + 0.3);
    const px = Math.round(130 * (1 + 0.5 * (1 - ease(k))));
    text(ctx, `NOITE ${seg.n}`, 540, 210, px, { color: seg.n === 23 ? C.flameLight : C.paper, stroke: "#0a0814", alpha: k * 1.0 });
    if (seg.from > 22) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - span(t, seg.from, seg.from + 0.18))})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ================================================================ 7. wipe
const WIPE_STATS = [
  { label: "Nível", from: 12, to: 1 },
  { label: "Noite", from: 23, to: 1 },
  { label: "Construções", from: 7, to: 0 },
];

function drawGlitch(ctx: Ctx, t: number, tmp: HTMLCanvasElement) {
  const k = span(t, FIRE_OUT + 0.25, 33);
  const x = tmp.getContext("2d")!;
  x.clearRect(0, 0, W, H);
  x.drawImage(ctx.canvas, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const frame = Math.floor(t * TRAILER_FPS);
  const r = rng(frame * 13 + 1);
  let y = 0;
  while (y < H) {
    const h = 24 + Math.floor(r() * 140);
    const off = (r() - 0.5) * 220 * (0.3 + k);
    ctx.drawImage(tmp, 0, y, W, h, Math.round(off / 8) * 8, y, W, h);
    y += h;
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? "rgba(222,74,71,0.5)" : "rgba(108,197,214,0.4)";
    ctx.fillRect(0, Math.floor(r() * H / 8) * 8, W, 8 + Math.floor(r() * 4) * 8);
  }
  ctx.restore();
  ctx.fillStyle = `rgba(0,0,0,${ease(k)})`;
  ctx.fillRect(0, 0, W, H);
}

function drawWipe(ctx: Ctx, t: number) {
  ctx.fillStyle = "#050307";
  ctx.fillRect(0, 0, W, H);
  // stats rolling back to zero
  const a = win(t, 33.8, 36.3, 0.35);
  if (a > 0) {
    WIPE_STATS.forEach((s, i) => {
      const k = ease(span(t, 34.4 + i * 0.25, 35.4 + i * 0.25));
      const v = Math.round(lerp(s.from, s.to, k));
      const y = 1080 + i * 120;
      text(ctx, s.label, 220, y, 64, { align: "left", color: "#9a8a90", alpha: a, stroke: "#050307" });
      text(ctx, String(v), 860, y, 76, { align: "right", color: k >= 1 ? C.flame : C.paper, alpha: a, stroke: "#050307" });
    });
  }
  // only the items stay
  const b = span(t, 36.4, 37.0);
  if (b > 0) {
    const bob = Math.round(Math.sin(t * 3) * 1) * 10;
    radial(ctx, 540, 920, 520, "rgba(111,214,232,1)", 0.3 * b);
    drawS(ctx, SWORDS[3], 330 - 8 * 20, 920 - 8 * 20 + bob, 20, { alpha: b, white: 1 - span(t, 36.4, 36.9) });
    drawS(ctx, ARMORS[3], 750 - 7 * 22, 920 - Math.round(6.5 * 22) - bob, 22, { alpha: b, white: 1 - span(t, 36.4, 36.9) });
    for (let i = 0; i < 10; i++) {
      const ph = (t * 0.8 + i / 10) % 1;
      ctx.globalAlpha = b * Math.sin(ph * Math.PI);
      ctx.fillStyle = "#dcf9fd";
      const x = Math.round((180 + hash(i) * 720) / 8) * 8;
      const y = Math.round((700 + hash(i * 5) * 440 - ph * 80) / 8) * 8;
      ctx.fillRect(x, y, 12, 12);
    }
    ctx.globalAlpha = 1;
  }
}

// ================================================================ 8. end card
const END_ROW: { avatar: AvatarKey; x: number; dir: Direction }[] = [
  { avatar: "joao-pedro", x: 110, dir: "right" },
  { avatar: "drielly", x: 250, dir: "right" },
  { avatar: "diego", x: 390, dir: "right" },
  { avatar: "rodrigo", x: 690, dir: "left" },
  { avatar: "sofia", x: 830, dir: "left" },
  { avatar: "alex", x: 970, dir: "left" },
];

function drawEnd(ctx: Ctx, t: number) {
  const local = t - 39;
  ctx.fillStyle = "#160a12";
  ctx.fillRect(0, 0, W, H);
  radial(ctx, 540, 640, 900, "rgba(110,32,64,1)", 1, "source-over");
  embers(ctx, t, 34, 0.8, 21);

  const la = ease(span(local, 0.1, 0.8));
  radial(ctx, 540, 560, 420 + Math.sin(t * 5) * 12, "rgba(229,96,58,1)", 0.35 * la);
  drawS(ctx, LOGO, 540 - 10 * 18, 380 - Math.round((1 - la) * 3) * 18, 18, { alpha: la });

  const ta = span(local, 0.6, 1.1);
  text(ctx, "SÍTIO DAE HAN", 540, 920 + (1 - ta) * 30, 128, { color: C.paper, stroke: C.wineDark, shadow: C.flame, alpha: ta, maxW: 1040 });
  text(ctx, "Em breve", 540, 1080, 96, { color: C.flameLight, stroke: "#160a12", alpha: span(local, 1.3, 1.7) });
  text(ctx, "Junte seu grupo", 540, 1200, 60, { color: C.gold, stroke: "#160a12", alpha: span(local, 2.0, 2.4) });

  const ra = span(local, 0.3, 0.9);
  radial(ctx, 540, 1600, 360, "rgba(255,170,80,1)", 0.35 * ra);
  drawFeet(ctx, CAMPFIRE[Math.floor(t / 0.15) % 2], 540, 1720, 12, { alpha: ra });
  for (const p of END_ROW) {
    drawFeet(ctx, WALKERS[p.avatar][p.dir][0], p.x, 1740, 8, { alpha: ra });
  }
}

// ================================================================ master
interface Stage {
  arena: HTMLCanvasElement;
  dark: HTMLCanvasElement;
  tmp: HTMLCanvasElement;
}

function drawCaptions(ctx: Ctx, t: number) {
  let shade = 0;
  for (const c of CAPTIONS) if (!c.y) shade = Math.max(shade, win(t, c.from, c.to, 0.3));
  if (shade > 0) {
    const g = ctx.createLinearGradient(0, 1340, 0, H);
    g.addColorStop(0, "rgba(20,10,16,0)");
    g.addColorStop(0.5, "rgba(20,10,16,0.55)");
    g.addColorStop(1, "rgba(20,10,16,0.75)");
    ctx.globalAlpha = shade;
    ctx.fillStyle = g;
    ctx.fillRect(0, 1340, W, H - 1340);
    ctx.globalAlpha = 1;
  }
  for (const c of CAPTIONS) {
    const a = win(t, c.from, c.to, 0.3);
    if (a <= 0) continue;
    const rise = (1 - ease(span(t, c.from, c.from + 0.35))) * 24;
    text(ctx, c.text, 540, (c.y ?? 1640) + rise, c.size ?? 84, { color: c.color, alpha: a, maxW: 940, stroke: "#1a0c14" });
  }
}

function drawLegacyFrame(ctx: Ctx, t: number, st: Stage) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (t < 4.1) drawIntro(ctx, t);
  else if (t < 11) drawDay(ctx, t);
  else if (t < 14.3) drawForge(ctx, t);
  else if (t < 17.5) drawSkills(ctx, t);
  else if (t < 33) {
    drawArena(ctx, t, st.arena, st.dark);
    if (t >= FIRE_OUT + 0.25) drawGlitch(ctx, t, st.tmp);
  } else if (t < 39) drawWipe(ctx, t);
  else drawEnd(ctx, t);

  drawCaptions(ctx, t);

  // transitions
  const black = Math.max(
    span(t, 3.7, 4.1) * (t < 4.1 ? 1 : 0),
    t >= 4.1 && t < 4.6 ? 1 - span(t, 4.1, 4.6) : 0,
    t >= 17.1 && t < 17.5 ? span(t, 17.1, 17.5) : 0,
    t >= 17.5 && t < 18 ? 1 - span(t, 17.5, 18) : 0,
    t >= 38.6 && t < 39 ? span(t, 38.6, 39) : 0,
    t >= 39 && t < 39.4 ? 1 - span(t, 39, 39.4) : 0,
  );
  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${black})`;
    ctx.fillRect(0, 0, W, H);
  }
  const white = Math.max(
    t >= 11 && t < 11.25 ? 1 - span(t, 11, 11.25) : 0,
    t >= 14.3 && t < 14.5 ? 0.8 * (1 - span(t, 14.3, 14.5)) : 0,
  );
  if (white > 0) {
    ctx.fillStyle = `rgba(255,248,232,${white})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ================================================================ v2: new scenes (phase 9)

interface ClassCard {
  avatar: AvatarKey;
  name: string;
  role: string;
  effect: string;
  weapon: SpriteDef;
  wscale: number;
  color: string;
  fx: "spike" | "shield" | "notes" | "hearts" | "light";
}
const CLASS_CARDS: ClassCard[] = [
  { avatar: "samuel", name: "Vôlei", role: "Atirador", effect: "Bate mais forte", weapon: VOLLEYBALL, wscale: 9, color: "#f0566a", fx: "spike" },
  { avatar: "gabriel-campos", name: "Colchonete", role: "Tanque", effect: "Segura a horda", weapon: MATTRESS, wscale: 6, color: "#6f9ee6", fx: "shield" },
  { avatar: "heloisa", name: "Violão", role: "Suporte", effect: "Anima o time", weapon: GUITAR, wscale: 7, color: "#f08ac8", fx: "notes" },
  { avatar: "diego", name: "Cozinheira", role: "Cura", effect: "Cuida da fogueira", weapon: LADLE, wscale: 7, color: "#8fe07a", fx: "hearts" },
  { avatar: "carol", name: "Lanterna", role: "Batedor", effect: "Enfraquece a horda", weapon: LANTERN, wscale: 8, color: "#ffe08a", fx: "light" },
];
const CARD_STEP = 1.05;

function drawRoles(ctx: Ctx, t: number) {
  const local = t - NEW_BEATS.roles[0];
  vertical(ctx, "#1d1430", "#0b0814");
  embers(ctx, t, 18, 0.35, 41);
  CLASS_CARDS.forEach((c, i) => {
    const at = 0.35 + i * CARD_STEP;
    const a = ease(span(local, at, at + 0.35));
    if (a <= 0) return;
    const y = 470 + i * 270;
    const active = local < at + CARD_STEP || i === CLASS_CARDS.length - 1;
    const slide = (1 - a) * 160;
    const dim = active ? 1 : 0.55;
    // card
    ctx.globalAlpha = a * (active ? 0.95 : 0.6);
    ctx.fillStyle = "#2a1d3d";
    ctx.fillRect(60 + slide, y - 110, 960, 220);
    ctx.fillStyle = c.color;
    ctx.fillRect(60 + slide, y - 110, 16, 220);
    ctx.globalAlpha = 1;
    const hx = 220 + slide;
    const k = local - at; // time since the card appeared
    if (active) radial(ctx, hx, y, 170, c.color, 0.18 + 0.1 * Math.sin(t * 6));
    // the class's special, while its card is the newest
    if (active && k > 0.2) {
      const p = (k - 0.2) % 1.2;
      if (c.fx === "notes") {
        for (let n = 0; n < 4; n++) {
          const q = (p + n * 0.3) % 1.2;
          drawS(ctx, NOTE, hx - 120 + n * 70, y + 40 - q * 160, 7, { alpha: dim * (1 - q / 1.2) });
        }
      } else if (c.fx === "hearts") {
        for (let n = 0; n < 3; n++) {
          const q = (p + n * 0.4) % 1.2;
          drawS(ctx, HEART, hx - 90 + n * 70, y + 20 - q * 150, 8, { alpha: dim * (1 - q / 1.2) });
        }
      } else if (c.fx === "light") {
        ctx.globalAlpha = dim * (0.35 + 0.25 * Math.sin(t * 9));
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.moveTo(hx + 70, y - 20);
        ctx.lineTo(1000, y - 100);
        ctx.lineTo(1000, y + 60);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (c.fx === "shield") {
        ctx.globalAlpha = dim * (0.3 + 0.2 * Math.sin(t * 10));
        ctx.strokeStyle = "#9cc8ff";
        ctx.lineWidth = 16;
        ctx.strokeRect(hx - 110, y - 100, 220, 200);
        ctx.globalAlpha = 1;
      } else {
        const q = (p % 0.6) / 0.6;
        drawS(ctx, SPIKE_BALL, hx + 60 + q * 640, y - 60 - Math.sin(q * Math.PI) * 60, 8, { alpha: dim });
      }
    }
    const frame = WALKERS[c.avatar].right[Math.floor(t / 0.16) % 2 === 0 ? 0 : 1];
    drawFeet(ctx, frame, hx, y + 90, 9, { alpha: a * dim, white: k < 0.15 ? 0.6 : 0 });
    const { h } = size(c.weapon);
    drawS(ctx, c.weapon, hx + 50, y + 40 - h * c.wscale, c.wscale, { alpha: a * dim });
    const tx = 400 + slide;
    text(ctx, c.name, tx, y - 40, 72, { color: C.paper, stroke: "#0b0814", alpha: a * dim, maxW: 580, align: "left" });
    text(ctx, c.role, tx, y + 30, 52, { color: c.color, stroke: "#0b0814", alpha: a * dim, maxW: 580, align: "left" });
    text(ctx, c.effect, tx, y + 85, 40, { color: "#d9cbe8", stroke: "#0b0814", alpha: a * dim, maxW: 580, align: "left" });
  });
}

const TASKS = ["Coletar 3 vezes", "Fazer a ronda", "Doar na obra"];

function drawMarket(ctx: Ctx, t: number) {
  const local = t - NEW_BEATS.market[0];
  vertical(ctx, "#f6dfb0", "#e7b877");
  // stall: awning, counter, goods
  const sx = 140;
  const sy = 420;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? C.paper : C.wine;
    ctx.fillRect(sx + i * 100, sy, 100, 110);
  }
  ctx.fillStyle = C.wineDark;
  ctx.fillRect(sx, sy + 110, 800, 16);
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(sx + 20, sy + 126, 24, 420);
  ctx.fillRect(sx + 756, sy + 126, 24, 420);
  ctx.fillStyle = C.wood;
  ctx.fillRect(sx - 20, sy + 470, 840, 90);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(sx - 20, sy + 470, 840, 18);
  text(ctx, "VENDINHA", 540, sy + 300, 100, { color: C.wineDark, stroke: C.paper });
  // goods on the counter, sliding in
  const goods = ["grain", "milk", "plank", "iron_bar", "cheese", "tool"] as const;
  goods.forEach((g, i) => {
    const k = ease(span(local, 0.1 + i * 0.12, 0.45 + i * 0.12));
    const icon = RESOURCE_SPRITES[g as keyof typeof RESOURCE_SPRITES];
    if (icon) drawFeet(ctx, icon, sx + 70 + i * 130 - (1 - k) * 300, sy + 470, 8, { alpha: k });
  });
  // coins raining into the counter + total
  const coins = Math.round(ease(span(local, 0.4, 2.2)) * 480);
  for (let i = 0; i < 14; i++) {
    const at = 0.4 + i * 0.12;
    const q = span(local, at, at + 0.5);
    if (q <= 0 || q >= 1) continue;
    drawS(ctx, COIN_T, 200 + ((i * 173) % 680), 330 + q * 640, 9, { alpha: 1 - q * 0.3 });
  }
  drawS(ctx, COIN_T, 330, 1150, 14);
  text(ctx, `+${coins}`, 600, 1200, 110, { color: C.goldDark, stroke: C.paper });
  // daily tasks being checked
  ctx.fillStyle = "#fff6e2";
  ctx.fillRect(160, 1340, 760, 380);
  ctx.fillStyle = C.wine;
  ctx.fillRect(160, 1340, 760, 70);
  text(ctx, "Tarefas do dia", 540, 1378, 52, { color: C.paper });
  TASKS.forEach((task, i) => {
    const done = local >= 0.8 + i * 0.5;
    const y = 1470 + i * 85;
    ctx.fillStyle = done ? "#5aa04a" : "#c9b48a";
    ctx.fillRect(210, y - 28, 56, 56);
    if (done) text(ctx, "✓", 238, y + 2, 52, { color: C.paper });
    text(ctx, task, 300, y, 48, { color: done ? "#5aa04a" : C.ink, stroke: "#fff6e2", maxW: 600, align: "left" });
  });
}

const BAG_DROPS: { cell: number; tier: number; armor: boolean; at: number }[] = [
  { cell: 0, tier: 0, armor: false, at: 0.4 },
  { cell: 1, tier: 1, armor: true, at: 0.75 },
  { cell: 2, tier: 0, armor: true, at: 1.05 },
  { cell: 3, tier: 2, armor: false, at: 1.35 },
  { cell: 4, tier: 1, armor: false, at: 1.65 },
  { cell: 5, tier: 2, armor: true, at: 1.95 },
  { cell: 6, tier: 3, armor: false, at: 2.25 },
];

function drawBackpack(ctx: Ctx, t: number) {
  const local = t - NEW_BEATS.backpack[0];
  vertical(ctx, "#163020", "#08130c");
  embers(ctx, t, 14, 0.3, 77);
  const cols = 4;
  const cell = 200;
  const gx = 540 - (cols * cell) / 2;
  const gy = 560;
  const found = BAG_DROPS.filter((d) => local >= d.at).length;
  text(ctx, `Mochila ${found} / 48`, 540, gy - 70, 60, { color: C.gold, stroke: "#08130c" });
  for (let i = 0; i < 12; i++) {
    const x = gx + (i % cols) * cell;
    const y = gy + Math.floor(i / cols) * cell;
    ctx.fillStyle = "#2d4a35";
    ctx.fillRect(x + 10, y + 10, cell - 20, cell - 20);
    ctx.fillStyle = "#1a2e21";
    ctx.fillRect(x + 22, y + 22, cell - 44, cell - 44);
  }
  for (const d of BAG_DROPS) {
    const k = span(local, d.at - 0.3, d.at);
    if (k <= 0) continue;
    const x = gx + (d.cell % cols) * cell + cell / 2;
    const y = gy + Math.floor(d.cell / cols) * cell + cell / 2;
    const fall = (1 - ease(k)) * 300;
    const tc = TIERS[d.tier];
    const flash = local >= d.at ? 1 - span(local, d.at, d.at + 0.3) : 0;
    ctx.fillStyle = tc.b;
    ctx.globalAlpha = k;
    ctx.fillRect(x - cell / 2 + 10, y - cell / 2 + 10, cell - 20, 10);
    ctx.globalAlpha = 1;
    const sp = d.armor ? ARMORS[d.tier] : SWORDS[d.tier];
    const sc = d.armor ? 9 : 8;
    const { w, h } = size(sp);
    drawS(ctx, sp, x - (w * sc) / 2, y - (h * sc) / 2 - fall, sc, { alpha: k, white: flash * 0.8 });
    if (flash > 0) radial(ctx, x, y, 160, tc.l, 0.4 * flash);
  }
  // equip or dismantle
  const e = span(local, 2.4, 2.8);
  text(ctx, "Equipe o melhor", 540, 1520, 72, { color: "#8fe07a", stroke: "#08130c", alpha: e });
  text(ctx, "ou desmonte em materiais", 540, 1610, 56, { color: C.paper, stroke: "#08130c", alpha: e });
}

function drawNewCaptions(ctx: Ctx, t: number) {
  for (const c of NEW_CAPTIONS) {
    const a = win(t, c.from, c.to, 0.3);
    if (a <= 0) continue;
    const rise = (1 - ease(span(t, c.from, c.from + 0.35))) * 24;
    text(ctx, c.text, 540, (c.y ?? 1640) + rise, c.size ?? 84, { color: c.color, alpha: a, maxW: 960, stroke: "#1a0c14" });
  }
}

/** v2 master: v1 up to INSERT_AT, the new scenes, then v1 shifted (timeline.ts). */
function drawFrame(ctx: Ctx, t: number, st: Stage) {
  const end = INSERT_AT + INSERT_LEN;
  if (t < INSERT_AT) return drawLegacyFrame(ctx, t, st);
  if (t >= end) return drawLegacyFrame(ctx, t - INSERT_LEN, st);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (t < NEW_BEATS.market[0]) drawRoles(ctx, t);
  else if (t < NEW_BEATS.backpack[0]) drawMarket(ctx, t);
  else drawBackpack(ctx, t);
  drawNewCaptions(ctx, t);
  // fade in from the skills' black, cut flashes between scenes, fade out to the sunset
  const black = Math.max(
    t < INSERT_AT + 0.5 ? 1 - span(t, INSERT_AT, INSERT_AT + 0.5) : 0,
    t >= end - 0.4 ? span(t, end - 0.4, end) : 0,
  );
  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${black})`;
    ctx.fillRect(0, 0, W, H);
  }
  const cut = Math.max(
    t >= NEW_BEATS.market[0] && t < NEW_BEATS.market[0] + 0.2 ? 1 - span(t, NEW_BEATS.market[0], NEW_BEATS.market[0] + 0.2) : 0,
    t >= NEW_BEATS.backpack[0] && t < NEW_BEATS.backpack[0] + 0.2 ? 1 - span(t, NEW_BEATS.backpack[0], NEW_BEATS.backpack[0] + 0.2) : 0,
  );
  if (cut > 0) {
    ctx.fillStyle = `rgba(255,248,232,${cut * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

declare global {
  interface Window {
    __setTrailerTime?: (t: number) => boolean;
    __trailerReady?: boolean;
  }
}

export function Trailer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fit, setFit] = useState(1);

  useEffect(() => {
    const onResize = () => setFit(Math.min(1, window.innerWidth / W, window.innerHeight / H));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let cancelled = false;
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      return c;
    };
    const params = new URLSearchParams(window.location.search);
    const capture = params.has("capture") || params.has("t");

    (async () => {
      const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
      if (fam) FONT_DISPLAY = fam;
      try {
        await document.fonts.load(`600 80px ${FONT_DISPLAY}`, "Sítio ção…");
        await document.fonts.ready;
      } catch {
        // fall back to whatever font is available
      }
      if (cancelled) return;
      const stage: Stage = { arena: buildArena(), dark: mk(), tmp: mk() };
      window.__setTrailerTime = (t: number) => {
        drawFrame(ctx, Math.max(0, Math.min(TRAILER_DURATION - 1e-3, t)), stage);
        return true;
      };
      window.__trailerReady = true;
      if (capture) {
        window.__setTrailerTime(Number(params.get("t") ?? 0));
        return;
      }
      const start = performance.now();
      const loop = () => {
        const t = ((performance.now() - start) / 1000) % TRAILER_DURATION;
        drawFrame(ctx, t, stage);
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.__trailerReady = false;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={ref}
        width={W}
        height={H}
        aria-label="Trailer do Sítio Dae Han"
        style={{ width: W * fit, height: H * fit, imageRendering: "pixelated", display: "block" }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { SpriteRects } from "./pixel";
import { WALKERS, WALKER_H, WALKER_W, type Direction } from "./walker";
import type { AvatarKey } from "./avatars";

const STEP_MS = 180;
const WALK_CYCLE = [1, 0, 2, 0]; // stepA, idle, stepB, idle

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

/** One avatar walking in place (or standing), scaled by an integer factor. */
export function Walker({
  avatar,
  direction = "down",
  walking = true,
  scale = 3,
  title,
}: {
  avatar: string;
  direction?: Direction | "spin";
  walking?: boolean;
  scale?: number;
  title?: string;
}) {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  const animate = walking && !reduced;
  useEffect(() => {
    if (!animate && direction !== "spin") return;
    const id = setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => clearInterval(id);
  }, [animate, direction]);

  const frames = WALKERS[avatar as AvatarKey];
  if (!frames) return null;
  const order: Direction[] = ["down", "right", "up", "left"];
  const dir = direction === "spin" ? order[Math.floor(tick / 8) % 4] : direction;
  const frame = animate ? WALK_CYCLE[tick % WALK_CYCLE.length] : 0;
  return (
    <svg
      viewBox={`0 0 ${WALKER_W} ${WALKER_H}`}
      width={WALKER_W * scale}
      height={WALKER_H * scale}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <SpriteRects sprite={frames[dir][frame]} />
    </svg>
  );
}

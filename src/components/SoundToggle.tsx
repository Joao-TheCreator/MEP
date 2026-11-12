"use client";

import { useEffect, useState } from "react";
import { isMuted, onMutedChange, play, setMuted } from "@/art/sound";

/** Sound on/off on the top bar; remembered on this device. */
export function SoundToggle() {
  const [muted, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    const off = onMutedChange(setM);
    return () => { off(); };
  }, []);
  const rows = ["....#...", "...##.#.", "####.#.#", "####.#.#", "####.#.#", "####.#.#", "...##.#.", "....#..."];
  return (
    <button type="button" className={`icon-btn ${muted ? "" : "on"}`} aria-pressed={!muted}
      aria-label={muted ? "Ligar os sons" : "Desligar os sons"}
      onClick={() => {
        setMuted(!muted);
        if (muted) play("tap");
      }}>
      <svg width={20} height={20} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
        {rows.flatMap((r, y) =>
          [...r].map((c, x) => (c === "#" && (!muted || x < 5) ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#f3d27a" /> : null)),
        )}
        {muted && <path d="M5.5 2.5 L7.5 5.5 M7.5 2.5 L5.5 5.5" stroke="#e5566b" strokeWidth={0.8} />}
      </svg>
    </button>
  );
}

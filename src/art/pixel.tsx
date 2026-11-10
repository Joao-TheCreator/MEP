import type { CSSProperties } from "react";

/** A sprite: rows of characters; each char maps to a color, "." is transparent. */
export interface SpriteDef {
  rows: string[];
  colors: Record<string, string>;
}

export function spriteSize(s: SpriteDef) {
  return { w: Math.max(...s.rows.map((r) => r.length)), h: s.rows.length };
}

/** Converts a sprite to horizontal runs of same-colored pixels (fewer SVG nodes). */
export function spriteRuns(s: SpriteDef, ox = 0, oy = 0) {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== "." && ch !== " ") {
        const fill = s.colors[ch];
        if (!fill) throw new Error(`sprite color "${ch}" missing`);
        runs.push({ x: x + ox, y: y + oy, w: end - x, fill });
      }
      x = end;
    }
  });
  return runs;
}

export function SpriteRects({ sprite, x = 0, y = 0 }: { sprite: SpriteDef; x?: number; y?: number }) {
  return (
    <>
      {spriteRuns(sprite, x, y).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </>
  );
}

/** Standalone pixel sprite, scaled by an integer factor. */
export function Sprite({
  sprite,
  scale = 3,
  title,
  className,
  style,
}: {
  sprite: SpriteDef;
  scale?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { w, h } = spriteSize(sprite);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <SpriteRects sprite={sprite} />
    </svg>
  );
}

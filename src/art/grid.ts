/** Tiny char-grid canvas used to build larger sprites procedurally. */
export class Grid {
  cells: string[][];
  constructor(public w: number, public h: number, fill = ".") {
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch;
  }
  get(x: number, y: number) {
    return this.cells[y]?.[x] ?? ".";
  }
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
  }
  /** Draws hand-made rows on top (".": keep what's below). */
  stamp(x: number, y: number, rows: string[]) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && this.set(x + i, y + j, ch)));
  }
  rows() {
    return this.cells.map((r) => r.join(""));
  }
}

/** Deterministic PRNG (mulberry32) so the art never changes between renders. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

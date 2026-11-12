/**
 * Timeline of the announcement trailer (/trailer). Times in seconds.
 * The trailer is a pure function of time so it can be captured frame by frame
 * (scripts/render-trailer.mjs) — change beats/texts here.
 */

export const TRAILER_W = 1080;
export const TRAILER_H = 1920;
export const TRAILER_FPS = 30;
export const TRAILER_DURATION = 44;

export const BEATS = {
  intro: [0, 4.1],
  day: [4.1, 11],
  forge: [11, 14.3],
  skills: [14.3, 17.5],
  sunset: [17.5, 22],
  night: [22, 33],
  wipe: [33, 39],
  end: [39, TRAILER_DURATION],
} as const;

export interface Caption {
  from: number;
  to: number;
  text: string;
  /** Center line (px). */
  y?: number;
  size?: number;
  color?: string;
}

export const CAPTIONS: Caption[] = [
  { from: 1.0, to: 4.0, text: "Na chácara, de dia…", y: 1360 },
  { from: 4.5, to: 7.7, text: "Cuide do sítio com seus amigos" },
  { from: 7.7, to: 10.9, text: "Colete, fabrique, construa" },
  { from: 11.2, to: 14.3, text: "Forje armas e armaduras" },
  { from: 14.5, to: 17.4, text: "Evolua sua classe" },
  { from: 18.2, to: 21.9, text: "Mas quando a noite cai…" },
  { from: 22.3, to: 26.0, text: "…eles vêm.", color: "#f0566a" },
  { from: 26.0, to: 31.8, text: "Cada noite, mais fortes.", color: "#f0566a" },
  { from: 33.2, to: 36.3, text: "Se a fogueira apagar, tudo recomeça do zero.", y: 760 },
  { from: 36.5, to: 39.0, text: "Só os itens ficam.", y: 1420 },
];

/** Night counter segments (horde beat). */
export const NIGHTS = [
  { n: 1, from: 22, to: 25, count: 5, seed: 101 },
  { n: 7, from: 25, to: 28, count: 14, seed: 707 },
  { n: 23, from: 28, to: 33, count: 30, seed: 2323 },
] as const;

/** Moment the campfire goes out. */
export const FIRE_OUT = 32.2;

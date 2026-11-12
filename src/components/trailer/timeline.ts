/**
 * Timeline of the announcement trailer (/trailer). Times in seconds.
 * The trailer is a pure function of time so it can be captured frame by frame
 * (scripts/render-trailer.mjs) — change beats/texts here.
 */

export const TRAILER_W = 1080;
export const TRAILER_H = 1920;
export const TRAILER_FPS = 30;
/**
 * v2 (phase 9): 12 s of new scenes are inserted at INSERT_AT (the five classes,
 * the shop and daily tasks, the backpack). Everything that was after it is the
 * v1 timeline shifted by INSERT_LEN; `legacyTime` maps back to v1 times, which
 * the older scenes (BEATS, CAPTIONS, NIGHTS, FIRE_OUT) still use.
 */
export const INSERT_AT = 17.5;
export const INSERT_LEN = 12;
export const TRAILER_DURATION = 44 + INSERT_LEN;

export function legacyTime(t: number) {
  return t < INSERT_AT ? t : t - INSERT_LEN;
}

/** New scenes (v2 times). */
export const NEW_BEATS = {
  roles: [17.5, 23.5],
  market: [23.5, 26.5],
  backpack: [26.5, 29.5],
} as const;

/** Captions of the new scenes (v2 times). */
export const NEW_CAPTIONS: { from: number; to: number; text: string; y?: number; size?: number; color?: string }[] = [
  { from: 17.8, to: 20.4, text: "Escolha seu papel", y: 250, size: 96 },
  { from: 20.6, to: 23.3, text: "Cinco classes, um time", y: 250, size: 96 },
  { from: 23.7, to: 26.4, text: "Venda, compre, cumpra as tarefas", y: 250, size: 80 },
  { from: 26.7, to: 29.3, text: "Ache itens na ronda", y: 250, size: 96 },
];

/** Legacy (v1) duration: the beats below use v1 times. */
export const LEGACY_DURATION = 44;

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

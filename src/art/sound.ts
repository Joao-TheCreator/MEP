/**
 * Game sounds (docs/visual-identity.md, "Sons"): short 8-bit effects made in the
 * browser with WebAudio — no audio files, all original. Same spirit as the
 * trailer music (square/triangle waves and a little noise).
 *
 * The AudioContext is created on the first sound after a tap (browsers block
 * audio before a gesture). Muting is per device (localStorage).
 */

export type SoundName =
  | "tap" | "collect" | "coin" | "build" | "levelUp" | "error"
  | "hit" | "hurt" | "campHit" | "enemyDown" | "special" | "waveClear" | "win" | "lose";

type Wave = OscillatorType | "noise";
/** One note: start (s), length (s), frequency (Hz, or start→end), wave, volume 0..1. */
type Note = [at: number, dur: number, freq: number | [number, number], wave: Wave, vol: number];

const n = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Each sound is a few short notes. MIDI numbers: 72 = C5. */
const SOUNDS: Record<SoundName, Note[]> = {
  tap: [[0, 0.04, n(84), "square", 0.25]],
  collect: [[0, 0.06, n(79), "square", 0.35], [0.06, 0.09, n(84), "square", 0.35]],
  coin: [[0, 0.05, n(88), "square", 0.3], [0.05, 0.14, n(93), "square", 0.3]],
  build: [[0, 0.1, n(72), "square", 0.3], [0.1, 0.1, n(76), "square", 0.3], [0.2, 0.1, n(79), "square", 0.3], [0.3, 0.3, n(84), "triangle", 0.5]],
  levelUp: [[0, 0.08, n(76), "square", 0.3], [0.08, 0.08, n(79), "square", 0.3], [0.16, 0.08, n(84), "square", 0.3], [0.24, 0.35, n(88), "square", 0.3]],
  error: [[0, 0.09, n(57), "square", 0.3], [0.1, 0.16, n(52), "square", 0.3]],
  hit: [[0, 0.04, 900, "noise", 0.18]],
  hurt: [[0, 0.1, [n(64), n(52)], "square", 0.25]],
  campHit: [[0, 0.12, 300, "noise", 0.3], [0, 0.12, [n(48), n(43)], "triangle", 0.4]],
  enemyDown: [[0, 0.12, [n(79), n(60)], "square", 0.2]],
  special: [[0, 0.3, [n(60), n(84)], "square", 0.25], [0.05, 0.3, [n(67), n(91)], "triangle", 0.35]],
  waveClear: [[0, 0.1, n(79), "triangle", 0.5], [0.1, 0.25, n(84), "triangle", 0.5]],
  win: [[0, 0.12, n(72), "square", 0.3], [0.12, 0.12, n(76), "square", 0.3], [0.24, 0.12, n(79), "square", 0.3], [0.36, 0.5, n(84), "triangle", 0.5]],
  lose: [[0, 0.2, n(67), "triangle", 0.5], [0.2, 0.2, n(63), "triangle", 0.5], [0.4, 0.5, n(60), "triangle", 0.5]],
};

export const SOUND_NAMES = Object.keys(SOUNDS) as SoundName[];

const MASTER = 0.18;
/** The same sound never repeats faster than this (frequent ones wait longer). */
const MIN_GAP_MS = 60;
const GAP_MS: Partial<Record<SoundName, number>> = { hit: 130, hurt: 160, campHit: 220, enemyDown: 90 };
const KEY = "sitio-sound-muted";

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted: boolean | null = null;
const lastAt = new Map<SoundName, number>();
const listeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  for (const l of listeners) l(v);
}

export function onMutedChange(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function noise(ac: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  return noiseBuf;
}

/** Plays a sound (no-op when muted, on the server, or right after the same sound). */
export function play(name: SoundName) {
  if (isMuted()) return;
  const now = performance.now();
  if (now - (lastAt.get(name) ?? -1e9) < (GAP_MS[name] ?? MIN_GAP_MS)) return;
  lastAt.set(name, now);
  const ac = audio();
  if (!ac) return;
  if (process.env.NODE_ENV !== "production") (window as unknown as { __sounds?: string[] }).__sounds?.push(name);
  const t0 = ac.currentTime + 0.01;
  for (const [at, dur, freq, wave, vol] of SOUNDS[name]) {
    const g = ac.createGain();
    const start = t0 + at;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol * MASTER, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(ac.destination);
    let src: AudioScheduledSourceNode;
    if (wave === "noise") {
      const b = ac.createBufferSource();
      b.buffer = noise(ac);
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = typeof freq === "number" ? freq : freq[0];
      b.connect(f).connect(g);
      src = b;
    } else {
      const o = ac.createOscillator();
      o.type = wave;
      const [f0, f1] = typeof freq === "number" ? [freq, freq] : freq;
      o.frequency.setValueAtTime(f0, start);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      o.connect(g);
      src = o;
    }
    src.start(start);
    src.stop(start + dur + 0.02);
  }
}

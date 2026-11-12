// Original procedural chiptune for the trailer (/trailer), written as a 16-bit WAV.
// Usage: node scripts/trailer-music.mjs out.wav
// Day: calm square/triangle tune in C. Night: drone + drums in A minor.
// Wipe: noise hit. End card: warm chord with the day motif.
import { writeFileSync } from "node:fs";

const SR = 44100;
const DUR = 44;
const N = SR * DUR;
const mix = new Float32Array(N);

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

const waves = {
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  pulse: (p) => (p % 1 < 0.25 ? 1 : -1),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  sine: (p) => Math.sin(2 * Math.PI * p),
};

/** Adds one note. env: attack/release in seconds. */
function note(t, dur, freq, vol, wave = "square", { a = 0.01, r = 0.08, slide = 0, vib = 0 } = {}) {
  const s0 = Math.floor(t * SR);
  const len = Math.floor((dur + r) * SR);
  let phase = 0;
  for (let i = 0; i < len && s0 + i < N; i++) {
    const tt = i / SR;
    const f = freq * (1 + slide * (tt / (dur + r))) * (1 + vib * Math.sin(2 * Math.PI * 5 * tt));
    phase += f / SR;
    let env = Math.min(1, tt / a);
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / r);
    if (s0 + i >= 0) mix[s0 + i] += waves[wave](phase) * vol * env;
  }
}

function hit(t, dur, vol, { lp = 0.5 } = {}) {
  const s0 = Math.floor(t * SR);
  let y = 0;
  for (let i = 0; i < dur * SR && s0 + i < N; i++) {
    y += lp * (noise() - y);
    mix[s0 + i] += y * vol * (1 - i / (dur * SR)) ** 2;
  }
}

function kick(t, vol = 0.5) {
  note(t, 0.12, 110, vol, "sine", { a: 0.002, r: 0.08, slide: -0.7 });
}

// ------------------------------------------------------------- intro 0–4.1
for (const m of [48, 55, 59, 64]) note(0.3, 3.4, midi(m), 0.05, "tri", { a: 1.2, r: 0.6 });
[72, 76, 79, 83, 79, 76].forEach((m, i) => note(1.0 + i * 0.45, 0.3, midi(m), 0.035, "pulse", { r: 0.4 }));

// ------------------------------------------------------------- day 4.1–17.5 (C major, 104 bpm)
const B = 60 / 104;
const DAY0 = 4.1;
const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]]; // C Am F G
const melody = [
  [76, 1], [79, 1], [81, 1], [79, 1], [76, 2], [74, 2],
  [72, 1], [74, 1], [76, 1], [79, 1], [74, 4],
  [76, 1], [79, 1], [84, 1], [81, 1], [79, 2], [76, 2],
  [74, 1], [76, 1], [72, 2], [72, 4],
];
for (let bar = 0; DAY0 + bar * 4 * B < 17.3; bar++) {
  const t0 = DAY0 + bar * 4 * B;
  const ch = chords[bar % 4];
  for (let b = 0; b < 4; b++) {
    const t = t0 + b * B;
    if (t > 17.3) break;
    note(t, B * 0.6, midi(ch[0] - 12), 0.11, "tri", { r: 0.05 });
    note(t + B / 2, B * 0.3, midi(ch[b % 2 ? 2 : 1]), 0.025, "pulse", { r: 0.05 });
    hit(t + B / 2, 0.04, 0.05, { lp: 0.9 });
    if (b % 2 === 0 && t > 7.6) kick(t, 0.25);
  }
}
{
  let t = DAY0 + 4 * B;
  let k = 0;
  while (t < 17.0) {
    const [m, len] = melody[k % melody.length];
    note(t, len * B * 0.5 * 0.85, midi(m), 0.055, "square", { r: 0.1, vib: 0.004 });
    t += len * B * 0.5;
    k++;
  }
}
// forge: anvil clinks at each tier
for (const t of [11, 11.8, 12.6, 13.4]) {
  note(t, 0.05, midi(96), 0.07, "square", { a: 0.001, r: 0.35 });
  note(t, 0.05, midi(103), 0.04, "pulse", { a: 0.001, r: 0.3 });
  hit(t, 0.08, 0.15, { lp: 0.8 });
}
// skills: rising chimes ("+1 nível")
[0.55, 1.05, 1.55, 2.0, 2.4, 2.8].forEach((d, i) => {
  const t = 14.3 + d;
  note(t, 0.08, midi(79 + i * 2), 0.05, "pulse", { r: 0.2 });
  note(t + 0.08, 0.1, midi(84 + i * 2), 0.04, "pulse", { r: 0.25 });
});

// ------------------------------------------------------------- sunset 17.5–22
[[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]].forEach((ch, i) => {
  for (const m of ch) note(17.6 + i * 1.1, 1.0, midi(m), 0.04, "tri", { a: 0.3, r: 0.6 });
  note(17.6 + i * 1.1, 1.0, midi(ch[0] - 24), 0.08, "tri", { a: 0.2, r: 0.5 });
});
[76, 74, 72, 71, 69].forEach((m, i) => note(18.0 + i * 0.75, 0.6, midi(m), 0.035, "square", { r: 0.3, vib: 0.006 }));
// fire lighting: whoosh
for (let i = 0; i < 6; i++) hit(19.6 + i * 0.03, 0.25, 0.05, { lp: 0.15 });

// ------------------------------------------------------------- night 22–32.2 (A minor, 120 bpm)
const NB = 0.5;
const FIRE_OUT = 32.2;
note(22, FIRE_OUT - 22, midi(33), 0.07, "square", { a: 1.0, r: 0.2, vib: 0.002 });
note(22, FIRE_OUT - 22, midi(40), 0.03, "tri", { a: 1.5, r: 0.2 });
for (const t of [22, 25, 28]) {
  note(t, 0.5, 70, 0.4, "sine", { a: 0.003, r: 0.6, slide: -0.6 });
  hit(t, 0.4, 0.2, { lp: 0.3 });
}
for (let t = 22; t < FIRE_OUT - 0.01; t += NB) {
  const intense = t >= 28 ? 2 : t >= 25 ? 1 : 0;
  kick(t, 0.45);
  hit(t + NB / 2, 0.03, 0.06 + 0.02 * intense, { lp: 0.95 });
  if (intense >= 1) hit(t + NB / 4, 0.02, 0.04, { lp: 0.95 });
  if (Math.round((t - 22) / NB) % 4 === 2) hit(t, 0.12, 0.16, { lp: 0.6 }); // snare
  // ominous arpeggio
  const arp = intense === 2 ? [57, 60, 64, 65] : [57, 60, 64, 60];
  const steps = intense === 0 ? 2 : 4;
  for (let s = 0; s < steps; s++) {
    const m = arp[(Math.round((t - 22) / NB) + s) % 4] + (intense === 2 ? 12 : 0);
    note(t + (s * NB) / steps, (NB / steps) * 0.6, midi(m), 0.03, "pulse", { r: 0.03 });
  }
}
// fire out: hit + falling sweep
hit(FIRE_OUT, 1.2, 0.45, { lp: 0.25 });
note(FIRE_OUT, 0.8, 220, 0.12, "square", { a: 0.002, r: 0.3, slide: -0.85 });
note(FIRE_OUT, 1.2, 55, 0.3, "sine", { a: 0.002, r: 0.8, slide: -0.5 });
// glitch crackles
for (let i = 0; i < 10; i++) hit(32.45 + i * 0.05, 0.03, 0.15 * (1 - i / 10), { lp: 0.9 });

// ------------------------------------------------------------- wipe 33–39
for (const m of [45, 52, 57]) note(33.2, 5.4, midi(m), 0.035, "tri", { a: 1.0, r: 0.6 });
for (let i = 0; i < 12; i++) note(34.4 + i * 0.13, 0.03, midi(84 - i), 0.025, "pulse", { r: 0.03 });
[81, 85, 88, 93].forEach((m, i) => note(36.4 + i * 0.12, 0.2, midi(m), 0.035, "pulse", { r: 0.6 }));

// ------------------------------------------------------------- end card 39–44
for (const m of [48, 55, 60, 62, 64, 67]) note(39.1, 4.2, midi(m), 0.04, "tri", { a: 0.4, r: 1.2 });
note(39.1, 4.2, midi(36), 0.09, "tri", { a: 0.2, r: 1.2 });
[[76, 0], [79, 0.3], [81, 0.6], [79, 0.9], [84, 1.5]].forEach(([m, d]) =>
  note(39.5 + d, d === 1.5 ? 1.8 : 0.25, midi(m), 0.05, "square", { r: 0.5, vib: 0.005 }),
);

// ------------------------------------------------------------- echo, fade, normalize, write
const D = Math.floor(0.21 * SR);
for (let i = D; i < N; i++) mix[i] += mix[i - D] * 0.28;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (t > DUR - 1.2) mix[i] *= (DUR - t) / 1.2;
  if (t < 0.05) mix[i] *= t / 0.05;
  peak = Math.max(peak, Math.abs(mix[i]));
}
const gain = 0.85 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write("WAVEfmt ", 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(N * 4, 40);
const lag = Math.floor(0.012 * SR); // tiny stereo widening
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, mix[i] * gain));
  const r = Math.max(-1, Math.min(1, (i >= lag ? mix[i - lag] : 0) * gain));
  out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
writeFileSync(process.argv[2] ?? "trailer-music.wav", out);
console.log(`music: ${DUR}s, peak normalized`);

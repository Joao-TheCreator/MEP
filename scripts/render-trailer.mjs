// Captures /trailer frame by frame and encodes an MP4 (9:16, 1080×1920, 30 fps).
//
// Usage (with `npx next dev -p 3002` running):
//   node scripts/render-trailer.mjs [outDir] [--url http://localhost:3002/trailer]
//                                   [--from 0] [--to 56] [--stills 5,12,24]
// Needs Playwright (global install is fine) and ffmpeg. Music: scripts/trailer-music.mjs.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const outDir = resolve(args[0] && !args[0].startsWith("--") ? args[0] : "trailer-out");
const url = opt("url", "http://localhost:3002/trailer?capture=1");
const FPS = 30;
const from = Number(opt("from", 0));
const to = Number(opt("to", 56));
const stills = opt("stills", "");

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch {
    const root = execFileSync("npm", ["root", "-g"]).toString().trim();
    return require(join(root, "playwright"));
  }
}

const { chromium } = loadPlaywright();
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(url.includes("?") ? url : `${url}?capture=1`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForFunction(() => window.__trailerReady === true, null, { timeout: 120_000 });
const canvas = page.locator("canvas");

if (stills) {
  for (const [i, t] of stills.split(",").map(Number).entries()) {
    await page.evaluate((t) => window.__setTrailerTime(t), t);
    await canvas.screenshot({ path: join(outDir, `still-${i + 1}.png`) });
    console.log(`still ${i + 1} @ ${t}s`);
  }
  await browser.close();
  process.exit(0);
}

const frames = join(outDir, "frames");
if (existsSync(frames)) rmSync(frames, { recursive: true });
mkdirSync(frames, { recursive: true });
const total = Math.round((to - from) * FPS);
const started = Date.now();
for (let f = 0; f < total; f++) {
  const t = from + f / FPS;
  await page.evaluate((t) => window.__setTrailerTime(t), t);
  await canvas.screenshot({ path: join(frames, `f${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % 60 === 0) console.log(`frame ${f}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
await browser.close();

const video = join(outDir, "video-only.mp4");
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "f%05d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", video,
], { stdio: "inherit" });
rmSync(frames, { recursive: true });
console.log(`video: ${video}`);

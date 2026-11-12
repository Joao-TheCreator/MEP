/**
 * Time of day on the farm map (roadmap 1b). Pure helpers: the map darkens
 * towards the night attack (20h, Brasília) and clears in the morning.
 */

/** Hour of the day in Brasília (UTC−3), with fraction (20.5 = 20h30). */
export function farmHour(now: Date): number {
  const h = (now.getUTCHours() + now.getUTCMinutes() / 60 - 3 + 24) % 24;
  return h;
}

const DUSK_START = 17;
const DUSK_END = 20;
const DAWN_START = 5;
const DAWN_END = 7;
export const MAX_DARKNESS = 0.6;

/** How dark the map is at this hour: 0 (day) to MAX_DARKNESS (night). */
export function darkness(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= DAWN_END && h < DUSK_START) return 0;
  if (h >= DUSK_START && h < DUSK_END) return (MAX_DARKNESS * (h - DUSK_START)) / (DUSK_END - DUSK_START);
  if (h >= DAWN_START && h < DAWN_END) return (MAX_DARKNESS * (DAWN_END - h)) / (DAWN_END - DAWN_START);
  return MAX_DARKNESS;
}

/** Night for the residents: those who patrolled gather around the campfire. */
export function isNight(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= 18 || h < 6;
}

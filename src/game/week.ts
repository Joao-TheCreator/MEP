import { RANKING_TIMEZONE } from "./config";

/** Offset (ms) of `timeZone` from UTC at instant `date` (e.g. −3h for São Paulo). */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Start of the ranking week (Monday 00:00 local time in RANKING_TIMEZONE) that
 * contains `now`, returned as a UTC instant.
 */
export function weekStart(now: Date, timeZone: string = RANKING_TIMEZONE): Date {
  const offset = tzOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset); // wall clock expressed in UTC fields
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMidnightMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  // Convert local wall time back to UTC (re-check offset at that instant for DST safety).
  const guess = new Date(localMidnightMonday - offset);
  return new Date(localMidnightMonday - tzOffsetMs(guess, timeZone));
}

export function previousWeekStart(now: Date, timeZone: string = RANKING_TIMEZONE): Date {
  const start = weekStart(now, timeZone);
  return weekStart(new Date(start.getTime() - 1), timeZone);
}

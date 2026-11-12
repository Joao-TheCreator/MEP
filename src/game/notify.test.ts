import { describe, expect, it } from "vitest";
import { brasiliaHour, dueNotifications, isQuietHour, type NotifyInput } from "./notify";

// 2026-11-12 at HH:MM in Brasília (UTC−3)
const at = (h: number, m = 0, day = 12) => new Date(Date.UTC(2026, 10, day, h + 3, m));

const base = (over: Partial<NotifyInput> = {}): NotifyInput => ({
  lastCollectedAt: at(9),
  storageHours: 4,
  patrolledTonight: false,
  energy: 100,
  patrolCost: 30,
  tonight: 5,
  lastNight: { night: 4, season: 1, wiped: false, fireHp: 500, at: at(20, 0, 11).toISOString() },
  fireMax: 600,
  ...over,
});
const kinds = (i: NotifyInput, now: Date) => dueNotifications(i, now).map((n) => n.kind);

describe("phone notices (design §23)", () => {
  it("knows the hour in Brasília and the quiet hours", () => {
    expect(brasiliaHour(at(18, 30))).toBe(18);
    expect(isQuietHour(at(23))).toBe(true);
    expect(isQuietHour(at(6, 59))).toBe(true);
    expect(isQuietHour(at(7))).toBe(false);
  });

  it("storage full: once the storage hours passed, keyed by the last collection", () => {
    expect(kinds(base(), at(12, 59))).not.toContain("storage_full");
    const n = dueNotifications(base(), at(13)).find((x) => x.kind === "storage_full");
    expect(n?.key).toBe(at(9).toISOString());
  });

  it("horde reminder: from 18h until the attack, only without patrol and with energy", () => {
    expect(kinds(base(), at(17, 59))).not.toContain("horde");
    expect(kinds(base(), at(18))).toContain("horde");
    expect(kinds(base(), at(19, 59))).toContain("horde");
    expect(kinds(base(), at(20))).not.toContain("horde");
    expect(kinds(base({ patrolledTonight: true }), at(18))).not.toContain("horde");
    expect(kinds(base({ energy: 29 }), at(18))).not.toContain("horde");
    expect(dueNotifications(base(), at(18)).find((x) => x.kind === "horde")?.key).toBe("5");
  });

  it("fire low: only below 35% and soon after the attack", () => {
    const low = base({ lastNight: { night: 4, season: 2, wiped: false, fireHp: 200, at: at(20, 0, 11).toISOString() } });
    expect(kinds(base(), at(7))).not.toContain("fire_low"); // 83%
    expect(dueNotifications(low, at(7)).find((x) => x.kind === "fire_low")).toMatchObject({ key: "2-4", title: "A fogueira está com 33% de vida" });
    expect(kinds(low, at(8, 1))).not.toContain("fire_low"); // more than 12 h later
  });

  it("wipe: everyone hears it once per season, instead of the fire notice", () => {
    const wiped = base({ lastNight: { night: 30, season: 3, wiped: true, fireHp: 0, at: at(20, 0, 11).toISOString() } });
    const n = dueNotifications(wiped, at(7));
    expect(n.map((x) => x.kind)).toEqual(["wipe"]);
    expect(n[0].key).toBe("3");
  });

  it("nothing in the quiet hours, and turned-off kinds are skipped", () => {
    expect(dueNotifications(base(), at(23))).toEqual([]);
    expect(kinds(base({ off: { storage_full: true } }), at(13))).not.toContain("storage_full");
  });
});

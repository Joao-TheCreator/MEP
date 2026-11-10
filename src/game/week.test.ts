import { describe, expect, it } from "vitest";
import { previousWeekStart, weekStart } from "./week";

describe("weekStart (America/Sao_Paulo, Monday 00:00)", () => {
  it("Wednesday afternoon → Monday 03:00 UTC", () => {
    expect(weekStart(new Date("2026-11-11T18:00:00Z")).toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });

  it("Sunday 23:30 local (Monday 02:30 UTC) still belongs to the previous week", () => {
    expect(weekStart(new Date("2026-11-16T02:30:00Z")).toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });

  it("Monday 00:00 local starts a new week", () => {
    expect(weekStart(new Date("2026-11-16T03:00:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });

  it("previous week", () => {
    expect(previousWeekStart(new Date("2026-11-11T18:00:00Z")).toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });
});

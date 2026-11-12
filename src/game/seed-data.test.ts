import { describe, expect, it } from "vitest";
import { AVATAR_KEYS } from "@/art/avatars";
import { RESOURCES, RESOURCE_KEYS } from "./config";
import seed from "../../scripts/seed-data.json";

/** The dev seed (scripts/seed-dev.mjs) is plain JS, so its data is checked here. */
describe("seed data", () => {
  it("uses the same resource points as the game", () => {
    expect(Object.keys(seed.points).sort()).toEqual([...RESOURCE_KEYS].sort());
    for (const k of RESOURCE_KEYS) {
      expect(seed.points[k as keyof typeof seed.points]).toBe(RESOURCES[k].points);
    }
  });

  it("lists every avatar exactly once", () => {
    expect(seed.people.map((p) => p.key).sort()).toEqual([...AVATAR_KEYS].sort());
  });
});

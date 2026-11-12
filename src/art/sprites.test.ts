import { describe, expect, it } from "vitest";
import { RESOURCE_KEYS } from "@/game/config";
import { AVATAR_KEYS, AVATAR_SPRITES } from "./avatars";
import { spriteRuns, spriteSize, type SpriteDef } from "./pixel";
import * as S from "./sprites";
import { WALKERS, WALKER_H, WALKER_W } from "./walker";

const all: Record<string, SpriteDef> = {
  LOGO: S.LOGO, TREE: S.TREE, TREE_DARK: S.TREE_DARK, PALM: S.PALM, POOL: S.POOL, HOUSE: S.HOUSE,
  WELL: S.WELL, BARN: S.BARN, MILL: S.MILL, CONSTRUCTION: S.CONSTRUCTION,
  temple: S.templeSprite(), annex: S.templeSprite(30),
  ...Object.fromEntries(Object.entries(S.RESOURCE_SPRITES).map(([k, v]) => [`res:${k}`, v])),
  ...Object.fromEntries(Object.entries(AVATAR_SPRITES).map(([k, v]) => [`avatar:${k}`, v])),
  ...Object.fromEntries(
    Object.entries(WALKERS).flatMap(([k, dirs]) =>
      Object.entries(dirs).flatMap(([d, frames]) => frames.map((f, i) => [`walker:${k}:${d}:${i}`, f])),
    ),
  ),
};

describe("sprites", () => {
  it.each(Object.entries(all))("%s uses only defined colors", (_, sprite) => {
    expect(() => spriteRuns(sprite)).not.toThrow();
  });

  it("every resource has an icon", () => {
    for (const k of RESOURCE_KEYS) expect(S.RESOURCE_SPRITES[k]).toBeDefined();
  });

  it("walkers are all the same size, 3 frames per direction", () => {
    for (const dirs of Object.values(WALKERS)) {
      for (const frames of Object.values(dirs)) {
        expect(frames).toHaveLength(3);
        for (const f of frames) expect(spriteSize(f)).toEqual({ w: WALKER_W, h: WALKER_H });
      }
    }
  });

  it("avatars are 20×22", () => {
    for (const k of AVATAR_KEYS) expect(spriteSize(AVATAR_SPRITES[k])).toEqual({ w: 20, h: 22 });
  });
});

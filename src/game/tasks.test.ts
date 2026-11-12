import { describe, expect, it } from "vitest";
import { DAILY_TASKS, ENERGY } from "./config";
import { allDoneBonus, claimTasks, dailyTasks, emptyCounters, energyNow, minutesUntilEnergy, taskDone, taskSeed } from "./tasks";

describe("daily tasks (design §17)", () => {
  it("gives three different tasks, the first always 'collect'", () => {
    for (let seed = 1; seed < 200; seed++) {
      const tasks = dailyTasks(seed, 3, "farmer", true);
      expect(tasks).toHaveLength(DAILY_TASKS.perDay);
      expect(tasks[0].kind).toBe("collect");
      expect(new Set(tasks.map((t) => t.kind)).size).toBe(3);
    }
  });

  it("is the same for the same seed and varies between days and players", () => {
    const seed = taskSeed("player-1", "2026-11-12");
    expect(dailyTasks(seed, 4, "rancher", true)).toEqual(dailyTasks(seed, 4, "rancher", true));
    expect(taskSeed("player-1", "2026-11-13")).not.toBe(seed);
    expect(taskSeed("player-2", "2026-11-12")).not.toBe(seed);
    const kinds = new Set<string>();
    for (let d = 1; d <= 28; d++) for (const t of dailyTasks(taskSeed("p", `2026-11-${d}`), 1, "farmer", true)) kinds.add(t.kind);
    expect([...kinds].sort()).toEqual(["collect", "craft", "donate", "gear", "patrol", "sell"]);
  });

  it("never asks to donate when nothing is being built", () => {
    for (let seed = 1; seed < 200; seed++) {
      expect(dailyTasks(seed, 5, "carpenter", false).some((t) => t.kind === "donate")).toBe(false);
    }
  });

  it("targets and rewards grow with the level; collect follows the profession", () => {
    const find = (level: number, prof: "farmer" | "rancher") => {
      for (let seed = 1; ; seed++) {
        const tasks = dailyTasks(seed, level, prof, true);
        if (tasks.some((t) => t.kind === "donate")) return tasks;
      }
    };
    const low = find(1, "farmer");
    const high = find(10, "farmer");
    expect(low[0]).toMatchObject({ target: 180, text: "Colete 180 de Grãos", coins: 35, xp: 24 });
    expect(high[0].target).toBe(340); // 60/h × 3 h × 1.9, rounded to tens
    expect(find(1, "rancher")[0]).toMatchObject({ target: 90, text: "Colete 90 de Leite" });
    const donate = (ts: typeof low) => ts.find((t) => t.kind === "donate")!;
    expect(donate(low).target).toBe(50);
    expect(donate(high).target).toBe(140);
    expect(high[0].coins).toBe(80);
  });

  it("claims only finished tasks, once, and the bonus after all three", () => {
    const tasks = dailyTasks(7, 2, "farmer", true);
    const c = emptyCounters();
    expect(claimTasks(tasks, c, 0, false, 2)).toEqual({ claimed: 0, bonusClaimed: false, coins: 0, xp: 0 });

    c.collect = tasks[0].target;
    expect(taskDone(tasks[0], c)).toBe(true);
    const first = claimTasks(tasks, c, 0, false, 2);
    expect(first).toEqual({ claimed: 1, bonusClaimed: false, coins: tasks[0].coins, xp: tasks[0].xp });
    // claiming again gives nothing
    expect(claimTasks(tasks, c, first.claimed, false, 2)).toMatchObject({ coins: 0, xp: 0 });

    for (const t of tasks) c[t.kind] = t.target;
    const rest = claimTasks(tasks, c, first.claimed, false, 2);
    expect(rest.claimed).toBe(0b111);
    expect(rest.bonusClaimed).toBe(true);
    expect(rest.coins).toBe(tasks[1].coins + tasks[2].coins + allDoneBonus(2));
    expect(claimTasks(tasks, c, rest.claimed, true, 2)).toMatchObject({ coins: 0, xp: 0 });
  });
});

describe("energy (design §17)", () => {
  const at = new Date("2026-11-12T12:00:00Z");
  const after = (h: number) => new Date(at.getTime() + h * 3_600_000);

  it("regenerates 10 per hour up to the max", () => {
    expect(energyNow(40, at, at)).toBe(40);
    expect(energyNow(40, at, after(3))).toBe(70);
    expect(energyNow(40, at, after(30))).toBe(ENERGY.max);
  });

  it("Agilidade speeds it up", () => {
    expect(energyNow(0, at, after(2), 50)).toBe(30);
  });

  it("a full bar pays for three patrols; the fourth needs a wait", () => {
    expect(Math.floor(ENERGY.max / ENERGY.patrolCost)).toBe(3);
    expect(minutesUntilEnergy(10, ENERGY.patrolCost)).toBe(120);
    expect(minutesUntilEnergy(30, ENERGY.patrolCost)).toBe(0);
  });
});

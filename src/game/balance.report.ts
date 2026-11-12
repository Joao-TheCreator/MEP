import { it } from "vitest";
import { GROUPS, simulateSeasons } from "./balance";

/** Not a test: `npm run balance` prints how seasons play out for each kind of group. */
it("balance report", () => {
  const lines: string[] = [];
  for (const [name, mix] of Object.entries(GROUPS)) {
    const seasons = simulateSeasons(mix, 3);
    lines.push(`\n## ${name} ${JSON.stringify(mix)}`);
    seasons.forEach((s, i) => {
      const last = s.nights.at(-1)!;
      lines.push(
        `season ${i + 1}: wiped on night ${s.wipedOnNight ?? "—"} · farm lv ${s.farmLevel} · avg char lv ${s.finalAvgLevel} · best weapon ${last.bestWeapon}`,
      );
    });
    lines.push(`all shooters instead: wiped on night ${simulateSeasons(mix, 1, "shooters")[0].wipedOnNight ?? "—"}`);
    const s1 = seasons[0];
    lines.push("night | horde | defense | fire | farm | avg lv | weapon");
    for (const n of s1.nights.filter((n) => n.night === 1 || n.night % 3 === 0 || n.night === s1.wipedOnNight)) {
      lines.push(`${n.night} | ${n.horde} | ${n.defense} | ${n.fireHp}/${n.fireMax} | ${n.farmLevel} | ${n.avgLevel} | ${n.bestWeapon}`);
    }
  }
  console.log(lines.join("\n"));
});

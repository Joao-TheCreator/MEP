import "server-only";
import {
  ATTRIBUTE_KEYS,
  NIGHT,
  NIGHT_CLASS_ROLE,
  SLOT_KEYS,
  TALENTS,
  type NightClassKey,
  type NightRoleKey,
  type ProfessionKey,
  type SlotKey,
  type TierKey,
} from "@/game/config";
import { characterBonuses, emptyAttributes, levelFromXp, type Attributes, type CharacterBuild, type GearItem, type Loadout, type TalentPicks } from "@/game/character";
import {
  farmDefense,
  fireAfterRest,
  fireMaxHp,
  nightComposition,
  nightTimesBetween,
  patrolXp,
  residentPower,
  resolveNight,
  type NightComposition,
  type NightOutcome,
} from "@/game/night";
import type { Tx } from "./db";

/**
 * Night hordes and the wipe on the server (design §15). Nights are resolved by
 * the clock inside the farm lock, like offline production: whoever acts first
 * after 20h applies the attack for everyone.
 */

export interface CharacterRow {
  id: string;
  profession: ProfessionKey;
  xp: string | number;
  attributes: Partial<Attributes>;
  talents: TalentPicks;
  gear: Partial<Record<SlotKey, { tier: TierKey; refine: number }>>;
  night_class: NightClassKey;
  patrol_night: number | null;
  last_collected_at: Date;
}

export interface NightFarmRow {
  id: string;
  level: number;
  season: number;
  nights_survived: number;
  fire_hp: number | null;
  last_night_at: Date;
}

export interface LastNight extends NightOutcome {
  /** % of the damage the tanks held back (absent on nights before the roles existed). */
  damageCutPct?: number;
  night: number;
  at: string;
  season: number;
}

/** Gear as the rules see it: every slot present (wooden +0 when never upgraded). */
export function loadoutOf(row: Pick<CharacterRow, "gear" | "profession" | "night_class">): Loadout {
  const out: Loadout = {};
  for (const slot of SLOT_KEYS) {
    const g = row.gear?.[slot] ?? { tier: "wood" as TierKey, refine: 0 };
    const item: GearItem = { slot, tier: g.tier, refine: g.refine };
    if (slot === "tool") item.kind = row.profession;
    if (slot === "weapon") item.kind = row.night_class;
    out[slot] = item;
  }
  return out;
}

export function attributesOf(row: Pick<CharacterRow, "attributes">): Attributes {
  const a = emptyAttributes();
  for (const k of ATTRIBUTE_KEYS) a[k] = Number(row.attributes?.[k] ?? 0);
  return a;
}

export function characterOf(row: CharacterRow) {
  const xp = Number(row.xp);
  const info = levelFromXp(xp);
  const build: CharacterBuild = {
    profession: row.profession,
    attributes: attributesOf(row),
    talents: (row.talents ?? []).slice(0, TALENTS[row.profession].length),
    gear: loadoutOf(row),
  };
  return { xp, ...info, build, bonuses: characterBonuses(build) };
}

/** Members that count for the horde: collected in the last NIGHT.activeWindowHours. */
export function activeCount(members: Pick<CharacterRow, "last_collected_at">[], at: Date): number {
  const since = at.getTime() - NIGHT.activeWindowHours * 3_600_000;
  return members.filter((m) => m.last_collected_at.getTime() >= since).length;
}

export function roleOf(row: Pick<CharacterRow, "night_class">): NightRoleKey {
  return NIGHT_CLASS_ROLE[row.night_class] ?? "shooter";
}

export function powerOf(row: CharacterRow, patrolled: boolean): number {
  const c = characterOf(row);
  return residentPower(c.level, c.bonuses, patrolled, roleOf(row));
}

/** The team for `night` (design §19): who patrolled plays their role, the others just add power. */
export function teamFor(members: CharacterRow[], night: number, activeMembers: number): NightComposition {
  const patrollers = members
    .filter((m) => m.patrol_night === night)
    .map((m) => ({ role: roleOf(m), power: powerOf(m, true) }));
  const resting = members.filter((m) => m.patrol_night !== night).reduce((a, m) => a + powerOf(m, false), 0);
  return nightComposition(patrollers, resting, activeMembers);
}

/** The farm's defense for a team: its power with the farm-level bonus. */
export function defenseOf(team: NightComposition, farmLevel: number): number {
  return farmDefense([team.power], farmLevel);
}

/**
 * Applies every attack due since the farm's last one. Must run with the farm row
 * locked (FOR UPDATE). Mutates `farm`. Returns the last night resolved, if any.
 */
export async function resolvePendingNights(tx: Tx, farm: NightFarmRow, now: Date): Promise<LastNight | null> {
  const due = nightTimesBetween(farm.last_night_at, now);
  if (due.length === 0) return null;
  let last: LastNight | null = null;
  for (const at of due) {
    const members = await tx<CharacterRow[]>`SELECT * FROM players WHERE farm_id = ${farm.id} FOR UPDATE`;
    const night = farm.nights_survived + 1;
    const active = activeCount(members, at);
    const fireMax = fireMaxHp(active, farm.level);
    const fireHp = fireAfterRest(farm.fire_hp ?? fireMax, fireMax);
    const team = teamFor(members, night, active);
    const out = resolveNight({
      night,
      activeMembers: active,
      defense: defenseOf(team, farm.level),
      fireHp,
      damageCutPct: team.damageCutPct,
    });
    last = { ...out, night, at: at.toISOString(), season: farm.season, damageCutPct: team.damageCutPct };

    if (out.wiped) {
      await wipeFarm(tx, farm, night, at);
    } else {
      farm.nights_survived = night;
      farm.fire_hp = out.fireHp;
      for (const m of members) {
        if (m.patrol_night === night) await tx`UPDATE players SET xp = xp + ${patrolXp(night)} WHERE id = ${m.id}`;
      }
    }
    farm.last_night_at = at;
    await tx`
      UPDATE farms SET nights_survived = ${farm.nights_survived}, fire_hp = ${farm.fire_hp},
        last_night_at = ${at}, last_night = ${tx.json(last as never)}
      WHERE id = ${farm.id}`;
  }
  return last;
}

/**
 * The fire went out: a new season starts at `at`. Only the gear is kept
 * (design §15.4). Donations stay, so the all-time ranking survives.
 */
async function wipeFarm(tx: Tx, farm: NightFarmRow, night: number, at: Date) {
  await tx`INSERT INTO seasons (farm_id, season, ended_night, ended_at) VALUES (${farm.id}, ${farm.season}, ${night}, ${at})`;
  await tx`DELETE FROM inventory WHERE player_id IN (SELECT id FROM players WHERE farm_id = ${farm.id})`;
  await tx`DELETE FROM player_workshops WHERE player_id IN (SELECT id FROM players WHERE farm_id = ${farm.id})`;
  await tx`DELETE FROM farm_building_progress WHERE farm_id = ${farm.id}`;
  await tx`DELETE FROM farm_buildings WHERE farm_id = ${farm.id}`;
  await tx`
    UPDATE players SET workshop_level = 1, xp = 0, coins = 0, attributes = '{}', talents = '[]',
      patrol_night = NULL, last_collected_at = ${at}, profession_changed_at = NULL
    WHERE farm_id = ${farm.id}`;
  farm.level = 1;
  farm.season += 1;
  farm.nights_survived = 0;
  farm.fire_hp = null;
  await tx`UPDATE farms SET level = 1, season = ${farm.season} WHERE id = ${farm.id}`;
}

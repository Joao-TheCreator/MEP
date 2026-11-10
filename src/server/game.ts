import "server-only";
import { randomInt } from "node:crypto";
import {
  FARM,
  PROFESSIONS,
  RECIPES,
  RESOURCES,
  RESOURCE_KEYS,
  type Bag,
  type ProfessionKey,
  type RecipeKey,
  type ResourceKey,
} from "@/game/config";
import {
  computeProduction,
  currentBuilding,
  isBuildingComplete,
  recipeInputs,
  remainingForBuilding,
  workshopUpgradeCost,
} from "@/game/rules";
import { previousWeekStart, weekStart } from "@/game/week";
import type { Sql } from "postgres";
import { db, type Tx } from "./db";

/** Error with a player-facing message (pt-BR). */
export class GameError extends Error {}

interface PlayerRow {
  id: string;
  user_id: string;
  farm_id: string;
  display_name: string;
  avatar: string;
  profession: ProfessionKey;
  workshop_level: number;
  last_collected_at: Date;
}

interface FarmRow {
  id: string;
  name: string;
  invite_code: string;
  level: number;
}

// ---------- inventory helpers ----------

async function getInventory(tx: Sql | Tx, playerId: string): Promise<Bag> {
  const rows = await tx<{ resource: ResourceKey; qty: number }[]>`
    SELECT resource, qty FROM inventory WHERE player_id = ${playerId}`;
  const bag: Bag = {};
  for (const r of rows) bag[r.resource] = r.qty;
  return bag;
}

async function addItems(tx: Tx, playerId: string, bag: Bag) {
  for (const [resource, qty] of Object.entries(bag) as [ResourceKey, number][]) {
    if (!qty) continue;
    await tx`
      INSERT INTO inventory (player_id, resource, qty) VALUES (${playerId}, ${resource}, ${qty})
      ON CONFLICT (player_id, resource) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty`;
  }
}

async function removeItems(tx: Tx, playerId: string, bag: Bag) {
  for (const [resource, qty] of Object.entries(bag) as [ResourceKey, number][]) {
    if (!qty) continue;
    const rows = await tx`
      UPDATE inventory SET qty = qty - ${qty}
      WHERE player_id = ${playerId} AND resource = ${resource} AND qty >= ${qty}
      RETURNING qty`;
    if (rows.length === 0) throw new GameError(`Você não tem ${RESOURCES[resource].name} suficiente.`);
  }
}

/** Moves pending production into the inventory (using the current rates). */
async function settle(tx: Tx, player: PlayerRow, farmLevel: number, now: Date) {
  const r = computeProduction({
    profession: player.profession,
    workshopLevel: player.workshop_level,
    farmLevel,
    lastCollectedAt: player.last_collected_at,
    now,
  });
  if (r.units > 0) await addItems(tx, player.id, { [PROFESSIONS[player.profession].produces]: r.units });
  await tx`UPDATE players SET last_collected_at = ${r.newLastCollectedAt} WHERE id = ${player.id}`;
  player.last_collected_at = r.newLastCollectedAt;
  return r;
}

// ---------- transactions ----------

/**
 * Runs `fn` in a transaction holding the farm row lock, so every action within
 * the same farm is serialized (no races, no deadlocks: farm lock is always first).
 */
async function withFarmTx<T>(
  userId: string,
  fn: (tx: Tx, player: PlayerRow, farm: FarmRow, now: Date) => Promise<T>,
): Promise<T> {
  return db().begin(async (tx) => {
    const [p] = await tx<{ farm_id: string }[]>`SELECT farm_id FROM players WHERE user_id = ${userId}`;
    if (!p) throw new GameError("Você ainda não entrou em um sítio.");
    const [farm] = await tx<FarmRow[]>`
      SELECT id, name, invite_code, level FROM farms WHERE id = ${p.farm_id} FOR UPDATE`;
    const [player] = await tx<PlayerRow[]>`SELECT * FROM players WHERE user_id = ${userId} FOR UPDATE`;
    return fn(tx, player, farm, new Date());
  }) as Promise<T>;
}

// ---------- onboarding ----------

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newInviteCode() {
  return Array.from({ length: 6 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");
}

export async function getPlayer(userId: string) {
  const rows = await db()<PlayerRow[]>`SELECT * FROM players WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export interface NewPlayer {
  displayName: string;
  avatar: string;
  profession: ProfessionKey;
}

async function insertPlayer(tx: Tx, userId: string, farmId: string, p: NewPlayer) {
  const taken = await tx`SELECT 1 FROM players WHERE farm_id = ${farmId} AND avatar = ${p.avatar}`;
  if (taken.length) throw new GameError("Esse boneco já foi escolhido por outra pessoa neste sítio.");
  await tx`
    INSERT INTO players (user_id, farm_id, display_name, avatar, profession)
    VALUES (${userId}, ${farmId}, ${p.displayName}, ${p.avatar}, ${p.profession})`;
}

export async function createFarm(userId: string, farmName: string, p: NewPlayer) {
  await db().begin(async (tx) => {
    if ((await tx`SELECT 1 FROM players WHERE user_id = ${userId}`).length) {
      throw new GameError("Você já está em um sítio.");
    }
    const [farm] = await tx<{ id: string }[]>`
      INSERT INTO farms (name, invite_code) VALUES (${farmName}, ${newInviteCode()}) RETURNING id`;
    await insertPlayer(tx, userId, farm.id, p);
  });
}

export async function joinFarm(userId: string, code: string, p: NewPlayer) {
  await db().begin(async (tx) => {
    if ((await tx`SELECT 1 FROM players WHERE user_id = ${userId}`).length) {
      throw new GameError("Você já está em um sítio.");
    }
    const [farm] = await tx<{ id: string }[]>`
      SELECT id FROM farms WHERE invite_code = ${code.trim().toUpperCase()} FOR UPDATE`;
    if (!farm) throw new GameError("Código de convite não encontrado.");
    const [{ count }] = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM players WHERE farm_id = ${farm.id}`;
    if (count >= FARM.maxMembers) throw new GameError(`Esse sítio já tem ${FARM.maxMembers} moradores.`);
    await insertPlayer(tx, userId, farm.id, p);
  });
}

// ---------- actions ----------

export async function collect(userId: string) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const r = await settle(tx, player, farm.level, now);
    return { units: r.units, capped: r.capped };
  });
}

export async function craft(userId: string, recipeKey: RecipeKey, times: number) {
  return withFarmTx(userId, async (tx, player) => {
    const recipe = RECIPES[recipeKey];
    if (recipe.profession !== player.profession) {
      throw new GameError(`Só ${PROFESSIONS[recipe.profession].name} sabe fazer ${recipe.name}.`);
    }
    await removeItems(tx, player.id, recipeInputs(recipeKey, times));
    await addItems(tx, player.id, { [recipe.output]: times });
  });
}

export async function upgradeWorkshop(userId: string) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const cost = workshopUpgradeCost(player.profession, player.workshop_level);
    if (!cost) throw new GameError("Sua oficina já está no nível máximo.");
    // Settle at the old rate before the rate changes.
    await settle(tx, player, farm.level, now);
    await removeItems(tx, player.id, cost);
    await tx`UPDATE players SET workshop_level = workshop_level + 1 WHERE id = ${player.id}`;
    return { level: player.workshop_level + 1 };
  });
}

export async function donate(userId: string, resource: ResourceKey, qty: number) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const building = currentBuilding(farm.level);
    if (!building) throw new GameError("Não há construção em andamento.");
    const progress = await getProgress(tx, farm.id);
    const remaining = remainingForBuilding(building, progress)[resource] ?? 0;
    if (remaining <= 0) throw new GameError(`${building.name} não precisa mais de ${RESOURCES[resource].name}.`);
    const amount = Math.min(qty, remaining);
    await removeItems(tx, player.id, { [resource]: amount });
    await tx`
      INSERT INTO farm_building_progress (farm_id, resource, qty) VALUES (${farm.id}, ${resource}, ${amount})
      ON CONFLICT (farm_id, resource) DO UPDATE SET qty = farm_building_progress.qty + EXCLUDED.qty`;
    const points = amount * RESOURCES[resource].points;
    await tx`
      INSERT INTO donations (farm_id, player_id, resource, qty, points)
      VALUES (${farm.id}, ${player.id}, ${resource}, ${amount}, ${points})`;

    progress[resource] = (progress[resource] ?? 0) + amount;
    let completed: string | null = null;
    if (isBuildingComplete(building, progress)) {
      // Settle everyone at the old farm level before the bonus kicks in.
      const members = await tx<PlayerRow[]>`
        SELECT * FROM players WHERE farm_id = ${farm.id} ORDER BY id FOR UPDATE`;
      for (const m of members) await settle(tx, m, farm.level, now);
      await tx`DELETE FROM farm_building_progress WHERE farm_id = ${farm.id}`;
      await tx`INSERT INTO farm_buildings (farm_id, building_key) VALUES (${farm.id}, ${building.key})`;
      await tx`UPDATE farms SET level = level + 1 WHERE id = ${farm.id}`;
      completed = building.name;
    }
    return { amount, points, completed };
  });
}

export async function transfer(userId: string, toPlayerId: string, resource: ResourceKey, qty: number) {
  return withFarmTx(userId, async (tx, player, farm) => {
    if (toPlayerId === player.id) throw new GameError("Você não pode enviar para si mesmo.");
    const [to] = await tx`SELECT id FROM players WHERE id = ${toPlayerId} AND farm_id = ${farm.id}`;
    if (!to) throw new GameError("Morador não encontrado neste sítio.");
    await removeItems(tx, player.id, { [resource]: qty });
    await addItems(tx, toPlayerId, { [resource]: qty });
    await tx`
      INSERT INTO transfers (farm_id, from_player_id, to_player_id, resource, qty)
      VALUES (${farm.id}, ${player.id}, ${toPlayerId}, ${resource}, ${qty})`;
  });
}

async function getProgress(tx: Sql | Tx, farmId: string): Promise<Bag> {
  const rows = await tx<{ resource: ResourceKey; qty: number }[]>`
    SELECT resource, qty FROM farm_building_progress WHERE farm_id = ${farmId}`;
  const bag: Bag = {};
  for (const r of rows) bag[r.resource] = r.qty;
  return bag;
}

// ---------- read model ----------

export interface RankingRow {
  playerId: string;
  name: string;
  avatar: string;
  profession: ProfessionKey;
  points: number;
}

export interface GameState {
  now: string;
  me: {
    id: string;
    name: string;
    avatar: string;
    profession: ProfessionKey;
    workshopLevel: number;
    lastCollectedAt: string;
    upgradeCost: Bag | null;
  };
  inventory: Bag;
  farm: {
    name: string;
    inviteCode: string;
    level: number;
    building: { key: string; name: string; description: string; cost: Bag } | null;
    progress: Bag;
    completed: string[];
  };
  members: { id: string; name: string; avatar: string; profession: ProfessionKey; workshopLevel: number }[];
  ranking: { week: RankingRow[]; lastWeek: RankingRow[]; allTime: RankingRow[] };
}

export async function loadGameState(userId: string): Promise<GameState | null> {
  const sql = db();
  const player = await getPlayer(userId);
  if (!player) return null;
  const now = new Date();
  const [[farm], inventory, progress, members, completed] = await Promise.all([
    sql<FarmRow[]>`SELECT id, name, invite_code, level FROM farms WHERE id = ${player.farm_id}`,
    getInventory(sql, player.id),
    getProgress(sql, player.farm_id),
    sql<PlayerRow[]>`SELECT * FROM players WHERE farm_id = ${player.farm_id} ORDER BY created_at`,
    sql<{ building_key: string }[]>`
      SELECT building_key FROM farm_buildings WHERE farm_id = ${player.farm_id} ORDER BY completed_at`,
  ]);

  const rankingSince = async (from: Date | null, to: Date | null): Promise<RankingRow[]> => {
    const rows = await sql<{ id: string; display_name: string; avatar: string; profession: ProfessionKey; points: number }[]>`
      SELECT p.id, p.display_name, p.avatar, p.profession, COALESCE(SUM(d.points), 0)::int AS points
      FROM players p
      LEFT JOIN donations d ON d.player_id = p.id
        AND (${from}::timestamptz IS NULL OR d.created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR d.created_at < ${to})
      WHERE p.farm_id = ${player.farm_id}
      GROUP BY p.id
      ORDER BY points DESC, p.display_name`;
    return rows.map((r) => ({
      playerId: r.id,
      name: r.display_name,
      avatar: r.avatar,
      profession: r.profession,
      points: r.points,
    }));
  };
  const thisWeek = weekStart(now);
  const [week, lastWeek, allTime] = await Promise.all([
    rankingSince(thisWeek, null),
    rankingSince(previousWeekStart(now), thisWeek),
    rankingSince(null, null),
  ]);

  const building = currentBuilding(farm.level);
  const cleanInventory: Bag = {};
  for (const k of RESOURCE_KEYS) if (inventory[k]) cleanInventory[k] = inventory[k];

  return {
    now: now.toISOString(),
    me: {
      id: player.id,
      name: player.display_name,
      avatar: player.avatar,
      profession: player.profession,
      workshopLevel: player.workshop_level,
      lastCollectedAt: player.last_collected_at.toISOString(),
      upgradeCost: workshopUpgradeCost(player.profession, player.workshop_level),
    },
    inventory: cleanInventory,
    farm: {
      name: farm.name,
      inviteCode: farm.invite_code,
      level: farm.level,
      building: building
        ? { key: building.key, name: building.name, description: building.description, cost: building.cost }
        : null,
      progress,
      completed: completed.map((c) => c.building_key),
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.display_name,
      avatar: m.avatar,
      profession: m.profession,
      workshopLevel: m.workshop_level,
    })),
    ranking: { week, lastWeek, allTime },
  };
}


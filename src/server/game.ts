import "server-only";
import { randomInt } from "node:crypto";
import {
  ATTRIBUTE_KEYS,
  ENERGY,
  FARM,
  PATROL,
  NIGHT_WEAPONS,
  PROFESSIONS,
  RECIPES,
  RESOURCES,
  RESOURCE_KEYS,
  type Bag,
  type ProfessionKey,
  type AttributeKey,
  type Building,
  type NightClassKey,
  type NightRoleKey,
  type RecipeKey,
  type ResourceKey,
  type SlotKey,
  SLOT_KEYS,
  TALENTS,
  SLOTS,
  TIERS,
} from "@/game/config";
import { attributePointsEarned, attributesError, gearUpgradeCost, nextTier, refineCost, talentsError, xpFor, type TalentPicks } from "@/game/character";
import { fireMaxHp, hordeStrength, nextNightTime, nightsFireLasts } from "@/game/night";
import {
  computeProduction,
  countProfessions,
  currentBuilding,
  isBuildingComplete,
  missingProfessions,
  professionChangeAvailableAt,
  professionChangeCost,
  recipeInputs,
  bagPoints,
  buildingCostScale,
  remainingForBuilding,
  workshopUpgradeCost,
} from "@/game/rules";
import { buyCost, buyPoints, dailyBuyLimit, gameDay, sellValue } from "@/game/market";
import {
  allDoneBonus,
  claimTasks,
  dailyTasks,
  energyNow,
  minutesUntilEnergy,
  taskDone,
  taskSeed,
  type DailyCounters,
  type TaskKind,
} from "@/game/tasks";
import { patrolRewards, replayPatrol, type HeroClass } from "@/game/patrol";
import { previousWeekStart, weekStart } from "@/game/week";
import type { Sql } from "postgres";
import { db, type Tx } from "./db";
import {
  activeCount,
  attributesOf,
  characterOf,
  defenseOf,
  roleOf,
  teamFor,
  loadoutOf,
  powerOf as residentPowerOf,
  resolvePendingNights,
  type CharacterRow,
  type LastNight,
  type NightFarmRow,
} from "./nights";

/** Error with a player-facing message (pt-BR). */
export class GameError extends Error {}

interface PlayerRow extends CharacterRow {
  coins: number;
  energy: number;
  energy_at: Date;
  id: string;
  user_id: string;
  farm_id: string;
  display_name: string;
  avatar: string;
  profession: ProfessionKey;
  workshop_level: number;
  last_collected_at: Date;
  profession_changed_at: Date | null;
}

interface FarmRow extends NightFarmRow {
  id: string;
  name: string;
  invite_code: string;
  level: number;
  last_night: LastNight | null;
}

/** A building's cost on this farm: it grows with the active members (#4, design §15.5). */
function scaledBuilding(building: Building, activeMembers: number): Building {
  const k = buildingCostScale(activeMembers);
  const cost: Bag = {};
  for (const [r, v] of Object.entries(building.cost) as [ResourceKey, number][]) cost[r] = Math.ceil(v * k);
  return { ...building, cost };
}

async function activeMembers(tx: Sql | Tx, farmId: string, now: Date) {
  const rows = await tx<{ last_collected_at: Date }[]>`SELECT last_collected_at FROM players WHERE farm_id = ${farmId}`;
  return activeCount(rows, now);
}

async function addXp(tx: Tx, playerId: string, xp: number) {
  if (xp > 0) await tx`UPDATE players SET xp = xp + ${xp} WHERE id = ${playerId}`;
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
    const [farm] = await tx<FarmRow[]>`SELECT * FROM farms WHERE id = ${p.farm_id} FOR UPDATE`;
    const now = new Date();
    // Attacks due since the last one happen first (they may wipe the farm).
    await resolvePendingNights(tx, farm, now);
    const [player] = await tx<PlayerRow[]>`SELECT * FROM players WHERE user_id = ${userId} FOR UPDATE`;
    return fn(tx, player, farm, now);
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
    // First attack only on the following day's night: a day to get started.
    const graceUntil = nextNightTime(new Date());
    const [farm] = await tx<{ id: string }[]>`
      INSERT INTO farms (name, invite_code, last_night_at) VALUES (${farmName}, ${newInviteCode()}, ${graceUntil}) RETURNING id`;
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
    await addXp(tx, player.id, xpFor("collect", r.units * RESOURCES[PROFESSIONS[player.profession].produces].points));
    await bump(tx, player, farm.level, now, "collect", r.units);
    return { units: r.units, capped: r.capped };
  });
}

export async function craft(userId: string, recipeKey: RecipeKey, times: number) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const recipe = RECIPES[recipeKey];
    if (recipe.profession !== player.profession) {
      throw new GameError(`Só ${PROFESSIONS[recipe.profession].name} sabe fazer ${recipe.name}.`);
    }
    await removeItems(tx, player.id, recipeInputs(recipeKey, times));
    await addItems(tx, player.id, { [recipe.output]: times });
    await addXp(tx, player.id, xpFor("craft", times * RESOURCES[recipe.output].points));
    await bump(tx, player, farm.level, now, "craft", times);
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

/** One donation inside the farm transaction (shared by donate and donateAll). */
async function donateIn(tx: Tx, player: PlayerRow, farm: FarmRow, now: Date, resource: ResourceKey, qty: number) {
  const base = currentBuilding(farm.level);
  if (!base) throw new GameError("Não há construção em andamento.");
  const building = scaledBuilding(base, await activeMembers(tx, farm.id, now));
  const progress = await getProgress(tx, farm.id);
  const remaining = remainingForBuilding(building, progress)[resource] ?? 0;
  if (remaining <= 0) throw new GameError(`${building.name} não precisa mais de ${RESOURCES[resource].name}.`);
  const amount = Math.min(qty, remaining);
  await removeItems(tx, player.id, { [resource]: amount });
  await tx`
    INSERT INTO farm_building_progress (farm_id, resource, qty) VALUES (${farm.id}, ${resource}, ${amount})
    ON CONFLICT (farm_id, resource) DO UPDATE SET qty = farm_building_progress.qty + EXCLUDED.qty`;
  const points = amount * RESOURCES[resource].points;
  await addXp(tx, player.id, xpFor("donate", points));
  await bump(tx, player, farm.level, now, "donate", points);
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
    farm.level += 1;
    completed = building.name;
  }
  return { amount, points, completed };
}

export async function donate(userId: string, resource: ResourceKey, qty: number) {
  return withFarmTx(userId, (tx, player, farm, now) => donateIn(tx, player, farm, now, resource, qty));
}

/** Donates everything the player has that the current building still needs, in one go. */
export async function donateAll(userId: string) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const base = currentBuilding(farm.level);
    if (!base) throw new GameError("Não há construção em andamento.");
    const building = scaledBuilding(base, await activeMembers(tx, farm.id, now));
    const remaining = remainingForBuilding(building, await getProgress(tx, farm.id));
    const inventory = await getInventory(tx, player.id);
    let points = 0;
    let kinds = 0;
    let completed: string | null = null;
    for (const [resource, need] of Object.entries(remaining) as [ResourceKey, number][]) {
      const give = Math.min(need, inventory[resource] ?? 0);
      if (give < 1 || completed) continue;
      const r = await donateIn(tx, player, farm, now, resource, give);
      points += r.points;
      kinds += 1;
      completed = r.completed;
    }
    if (kinds === 0) throw new GameError("Você não tem nada que a obra precise agora.");
    return { points, kinds, completed };
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

export async function changeProfession(userId: string, to: ProfessionKey) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const from = player.profession;
    if (to === from) throw new GameError(`Você já é ${PROFESSIONS[to].name}.`);
    const availableAt = professionChangeAvailableAt(player.profession_changed_at, now);
    if (availableAt) {
      const h = Math.ceil((availableAt.getTime() - now.getTime()) / 3_600_000);
      throw new GameError(`Você trocou de profissão há pouco. Tente de novo em ${h} h.`);
    }
    // Pending production belongs to the old profession: settle it first.
    await settle(tx, player, farm.level, now);
    await removeItems(tx, player.id, professionChangeCost(from));
    // Each profession keeps its own workshop level.
    await tx`
      INSERT INTO player_workshops (player_id, profession, level)
      VALUES (${player.id}, ${from}, ${player.workshop_level})
      ON CONFLICT (player_id, profession) DO UPDATE SET level = EXCLUDED.level`;
    const [saved] = await tx<{ level: number }[]>`
      SELECT level FROM player_workshops WHERE player_id = ${player.id} AND profession = ${to}`;
    const level = saved?.level ?? 1;
    await tx`
      UPDATE players
      SET profession = ${to}, workshop_level = ${level},
          last_collected_at = ${now}, profession_changed_at = ${now}
      WHERE id = ${player.id}`;
    return { profession: to, workshopLevel: level };
  });
}

/** Residents per profession on the farm with this invite code (for the join screen). */
export async function professionCountsByInvite(code: string) {
  const [farm] = await db()<{ id: string }[]>`
    SELECT id FROM farms WHERE invite_code = ${code.trim().toUpperCase()}`;
  if (!farm) return null;
  const rows = await db()<{ profession: ProfessionKey }[]>`
    SELECT profession FROM players WHERE farm_id = ${farm.id}`;
  const counts = countProfessions(rows.map((r) => r.profession));
  return { counts, missing: missingProfessions(counts) };
}

// ---------- daily tasks and energy (design §17) ----------

interface DailyRow extends DailyCounters {
  level: number;
  profession: ProfessionKey;
  can_donate: boolean;
  claimed: number;
  bonus_claimed: boolean;
}

/** Today's row for the player, created with a snapshot of level and profession on first use. */
async function dailyRow(tx: Sql | Tx, player: PlayerRow, farmLevel: number, now: Date): Promise<DailyRow> {
  const day = gameDay(now);
  await tx`
    INSERT INTO player_daily (player_id, day, level, profession, can_donate)
    VALUES (${player.id}, ${day}, ${characterOf(player).level}, ${player.profession}, ${currentBuilding(farmLevel) !== null})
    ON CONFLICT (player_id, day) DO NOTHING`;
  const [row] = await tx<DailyRow[]>`SELECT * FROM player_daily WHERE player_id = ${player.id} AND day = ${day}`;
  return row;
}

/** Counts something the player did today towards the daily tasks. */
async function bump(tx: Tx, player: PlayerRow, farmLevel: number, now: Date, kind: TaskKind, n: number) {
  if (n <= 0) return;
  await dailyRow(tx, player, farmLevel, now);
  await tx`
    UPDATE player_daily SET ${tx(kind)} = ${tx(kind)} + ${Math.floor(n)}
    WHERE player_id = ${player.id} AND day = ${gameDay(now)}`;
}

function tasksOf(player: PlayerRow, row: DailyRow, now: Date) {
  return dailyTasks(taskSeed(player.id, gameDay(now)), row.level, row.profession, row.can_donate);
}

/** Claims the rewards of every finished task (and the bonus for finishing all). */
export async function claimDailyTasks(userId: string) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const row = await dailyRow(tx, player, farm.level, now);
    const r = claimTasks(tasksOf(player, row, now), row, row.claimed, row.bonus_claimed, row.level);
    if (r.coins === 0 && r.xp === 0) throw new GameError("Nenhuma tarefa pronta para receber ainda.");
    await tx`
      UPDATE player_daily SET claimed = ${r.claimed}, bonus_claimed = ${r.bonusClaimed}
      WHERE player_id = ${player.id} AND day = ${gameDay(now)}`;
    await tx`UPDATE players SET coins = coins + ${r.coins} WHERE id = ${player.id}`;
    await addXp(tx, player.id, r.xp);
    return { coins: r.coins, xp: r.xp, bonus: r.bonusClaimed && !row.bonus_claimed };
  });
}

function energyOf(player: PlayerRow, now: Date) {
  return energyNow(player.energy, player.energy_at, now, characterOf(player).bonuses.energyRegenPct);
}

// ---------- Vendinha (design §16) ----------

async function boughtToday(tx: Sql | Tx, playerId: string, now: Date): Promise<number> {
  const [row] = await tx<{ points: number }[]>`
    SELECT points FROM market_buys WHERE player_id = ${playerId} AND day = ${gameDay(now)}`;
  return row?.points ?? 0;
}

/** Sells resources to the shop for coins. No XP and no ranking points. */
export async function sellToMarket(userId: string, resource: ResourceKey, qty: number) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const coins = sellValue(resource, qty);
    if (coins < 1) throw new GameError("Isso é pouco demais para vender. Junte mais um pouco.");
    await removeItems(tx, player.id, { [resource]: qty });
    await tx`UPDATE players SET coins = coins + ${coins} WHERE id = ${player.id}`;
    await bump(tx, player, farm.level, now, "sell", coins);
    return { coins };
  });
}

/** Buys resources from the shop: much dearer than trading, with a daily limit. */
export async function buyFromMarket(userId: string, resource: ResourceKey, qty: number) {
  return withFarmTx(userId, async (tx, player, _farm, now) => {
    const cost = buyCost(resource, qty);
    const points = buyPoints(resource, qty);
    const limit = dailyBuyLimit(characterOf(player).level);
    const left = limit - (await boughtToday(tx, player.id, now));
    if (points > left) {
      throw new GameError(left < RESOURCES[resource].points
        ? "Você já comprou o limite de hoje na Vendinha. Amanhã tem mais."
        : `Hoje você ainda pode comprar ${Math.floor(left / RESOURCES[resource].points)} de ${RESOURCES[resource].name}.`);
    }
    const paid = await tx`
      UPDATE players SET coins = coins - ${cost} WHERE id = ${player.id} AND coins >= ${cost} RETURNING coins`;
    if (paid.length === 0) throw new GameError("Moedas insuficientes.");
    await tx`
      INSERT INTO market_buys (player_id, day, points) VALUES (${player.id}, ${gameDay(now)}, ${points})
      ON CONFLICT (player_id, day) DO UPDATE SET points = market_buys.points + EXCLUDED.points`;
    await addItems(tx, player.id, { [resource]: qty });
    return { cost };
  });
}

// ---------- night & character (design §11, §12, §15) ----------

/** Class used in the patrol mini-game for each night class. */
function patrolClass(player: PlayerRow): HeroClass {
  return player.night_class === "mattress" ? "colchonete" : "volei";
}

async function expeditionsToday(tx: Sql | Tx, playerId: string, now: Date): Promise<number> {
  const [row] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM patrol_runs
    WHERE player_id = ${playerId} AND day = ${gameDay(now)} AND kind = 'expedition'`;
  return row.count;
}

/**
 * Starts a patrol: spends the energy and draws the seed. The first one of the
 * night counts for the defense; the others are expeditions, only for loot.
 */
export async function startPatrol(userId: string) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const night = farm.nights_survived + 1;
    const kind = player.patrol_night === night ? "expedition" : "patrol";
    if (kind === "expedition" && (await expeditionsToday(tx, player.id, now)) >= PATROL.expeditionsPerDay) {
      throw new GameError("Você já fez todas as expedições de hoje. Amanhã tem mais.");
    }
    const energy = energyOf(player, now);
    if (energy < ENERGY.patrolCost) {
      const wait = minutesUntilEnergy(energy, ENERGY.patrolCost, characterOf(player).bonuses.energyRegenPct);
      throw new GameError(`Você está sem energia para a ronda. Volte em ${wait} min.`);
    }
    // an abandoned run is closed, so only one is open at a time
    await tx`UPDATE patrol_runs SET finished_at = ${now}, stars = 0 WHERE player_id = ${player.id} AND finished_at IS NULL`;
    await tx`UPDATE players SET energy = ${energy - ENERGY.patrolCost}, energy_at = ${now} WHERE id = ${player.id}`;
    const cls = patrolClass(player);
    const seed = randomInt(1, 2_000_000_000);
    const [run] = await tx<{ id: string }[]>`
      INSERT INTO patrol_runs (player_id, day, night, kind, cls, seed)
      VALUES (${player.id}, ${gameDay(now)}, ${night}, ${kind}, ${cls}, ${seed}) RETURNING id`;
    return { runId: run.id, seed, cls, kind };
  });
}

/**
 * Ends a patrol: replays it from the seed with the special ticks the phone
 * sent, and pays what the replay earned. Finishing the night's patrol (won
 * or lost) is what counts for the defense.
 */
export async function finishPatrol(userId: string, runId: string, specialTicks: number[]) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const [run] = await tx<{ id: string; night: number; kind: string; cls: HeroClass; seed: number; created_at: Date }[]>`
      SELECT * FROM patrol_runs WHERE id = ${runId} AND player_id = ${player.id} AND finished_at IS NULL FOR UPDATE`;
    if (!run) throw new GameError("Essa ronda não está mais aberta.");
    if (now.getTime() - run.created_at.getTime() > PATROL.runMinutes * 60_000) {
      await tx`UPDATE patrol_runs SET finished_at = ${now}, stars = 0 WHERE id = ${run.id}`;
      throw new GameError("Essa ronda demorou demais e foi encerrada.");
    }
    const result = replayPatrol(run.cls, run.seed, specialTicks);
    const night = farm.nights_survived + 1;
    const rewards = patrolRewards(result.stars, night, run.seed);
    await tx`UPDATE patrol_runs SET finished_at = ${now}, stars = ${result.stars} WHERE id = ${run.id}`;
    await tx`UPDATE players SET coins = coins + ${rewards.coins} WHERE id = ${player.id}`;
    await addItems(tx, player.id, rewards.loot);
    // a wipe between start and end would have reset the season: only count the same night
    const counts = run.kind === "patrol" && run.night === night && player.patrol_night !== night;
    if (counts) await tx`UPDATE players SET patrol_night = ${night} WHERE id = ${player.id}`;
    await bump(tx, player, farm.level, now, "patrol", 1);
    return { ...result, ...rewards, kind: run.kind, counts, night };
  });
}

export async function upgradeGear(userId: string, slot: SlotKey) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const gear = { ...player.gear };
    const cur = gear[slot] ?? { tier: "wood" as const, refine: 0 };
    const cost = gearUpgradeCost(cur.tier);
    const next = nextTier(cur.tier);
    if (!cost || !next) throw new GameError("Esse item já está no tier máximo.");
    await removeItems(tx, player.id, cost);
    gear[slot] = { tier: next, refine: cur.refine };
    await tx`UPDATE players SET gear = ${tx.json(gear as never)} WHERE id = ${player.id}`;
    await addXp(tx, player.id, xpFor("craft", bagPoints(cost)));
    await bump(tx, player, farm.level, now, "gear", 1);
    return { tier: TIERS[next].name };
  });
}

export async function refineGear(userId: string, slot: SlotKey) {
  return withFarmTx(userId, async (tx, player, farm, now) => {
    const gear = { ...player.gear };
    const cur = gear[slot] ?? { tier: "wood" as const, refine: 0 };
    const cost = refineCost(cur.refine);
    if (!cost) throw new GameError("Esse item já está no refino máximo.");
    await removeItems(tx, player.id, cost);
    gear[slot] = { tier: cur.tier, refine: cur.refine + 1 };
    await tx`UPDATE players SET gear = ${tx.json(gear as never)} WHERE id = ${player.id}`;
    await addXp(tx, player.id, xpFor("craft", bagPoints(cost)));
    await bump(tx, player, farm.level, now, "gear", 1);
    return { refine: cur.refine + 1 };
  });
}

export async function addAttributePoint(userId: string, key: AttributeKey) {
  return withFarmTx(userId, async (tx, player) => {
    const c = characterOf(player);
    const attrs = attributesOf(player);
    attrs[key] += 1;
    const err = attributesError(attrs, c.level);
    if (err) throw new GameError(err);
    await tx`UPDATE players SET attributes = ${tx.json(attrs as never)} WHERE id = ${player.id}`;
  });
}

export async function pickTalent(userId: string, tier: number, option: 0 | 1) {
  return withFarmTx(userId, async (tx, player) => {
    const c = characterOf(player);
    const picks: TalentPicks = [...(player.talents ?? [])];
    while (picks.length <= tier) picks.push(null);
    if (picks[tier] !== null) throw new GameError("Esse talento já foi escolhido nesta temporada.");
    picks[tier] = option;
    const err = talentsError(player.profession, picks, c.level);
    if (err) throw new GameError(err);
    await tx`UPDATE players SET talents = ${tx.json(picks as never)} WHERE id = ${player.id}`;
    return TALENTS[player.profession][tier][option].name;
  });
}

export async function setNightClass(userId: string, nightClass: NightClassKey) {
  return withFarmTx(userId, async (tx, player, farm) => {
    if (player.patrol_night === farm.nights_survived + 1) {
      throw new GameError("Você já fez a ronda de hoje com essa classe. Troque amanhã.");
    }
    await tx`UPDATE players SET night_class = ${nightClass} WHERE id = ${player.id}`;
    return NIGHT_WEAPONS[nightClass].className;
  });
}

/** Development only: pretend the last attack was a day earlier, so the next one is due now. */
export async function devForceNight(userId: string) {
  if (process.env.NODE_ENV === "production") throw new GameError("Indisponível.");
  const [p] = await db()<{ farm_id: string }[]>`SELECT farm_id FROM players WHERE user_id = ${userId}`;
  if (!p) throw new GameError("Você ainda não entrou em um sítio.");
  return db().begin(async (tx) => {
    const [farm] = await tx<FarmRow[]>`SELECT * FROM farms WHERE id = ${p.farm_id} FOR UPDATE`;
    farm.last_night_at = new Date(farm.last_night_at.getTime() - 24 * 3_600_000);
    return resolvePendingNights(tx, farm, new Date());
  }) as Promise<LastNight | null>;
}

/** Applies attacks that are due (used before reading the game state). */
async function resolveDueNights(farmId: string) {
  await db().begin(async (tx) => {
    const [farm] = await tx<FarmRow[]>`SELECT * FROM farms WHERE id = ${farmId} FOR UPDATE`;
    await resolvePendingNights(tx, farm, new Date());
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
    coins: number;
    energy: { now: number; max: number; patrolCost: number };
    upgradeCost: Bag | null;
    /** Changing profession: what it costs now and when it is allowed (null = now). */
    professionChange: { cost: Bag; availableAt: string | null };
    character: {
      level: number;
      xpIntoLevel: number;
      xpForNext: number | null;
      attributes: Record<AttributeKey, number>;
      freePoints: number;
      talents: TalentPicks;
      bonuses: ReturnType<typeof characterOf>["bonuses"];
      nightClass: NightClassKey;
      gear: { slot: SlotKey; tier: string; refine: number; value: number; upgradeCost: Bag | null; refineCost: Bag | null }[];
      /** Power at night if you patrol / if you rest. */
      power: { patrol: number; rest: number };
    };
    patrolledTonight: boolean;
  };
  /** Vendinha: today's purchase limit (points of value) and how much is used. */
  market: { limit: number; used: number };
  /** Today's tasks (design §17). */
  tasks: {
    items: { kind: TaskKind; text: string; target: number; progress: number; done: boolean; claimed: boolean; coins: number; xp: number }[];
    bonusCoins: number;
    bonusClaimed: boolean;
    /** Something is finished and not claimed yet. */
    claimable: boolean;
  };
  night: {
    season: number;
    /** Number of the next attack in this season. */
    night: number;
    nextAt: string;
    fireHp: number;
    fireMax: number;
    horde: number;
    /** Defense if the attack were now (who already patrolled counts ×1.5). */
    defense: number;
    /** Nights the fire lasts at this pace (null = it holds). */
    lasts: number | null;
    /** Tonight's team among those who patrolled (design §19). */
    team: { counts: Record<NightRoleKey, number>; damageCutPct: number; supportBoostPct: number; missing: NightRoleKey[] };
    myRole: NightRoleKey;
    patrolled: number;
    active: number;
    /** Extra patrols (loot only) still available today. */
    expeditionsLeft: number;
    last: LastNight | null;
    seasons: { season: number; endedNight: number; endedAt: string }[];
  };
  inventory: Bag;
  farm: {
    name: string;
    inviteCode: string;
    level: number;
    building: { key: string; name: string; description: string; cost: Bag } | null;
    progress: Bag;
    completed: string[];
    /** Residents per profession, and the professions nobody has (the farm may get stuck). */
    professionCounts: Record<ProfessionKey, number>;
    missingProfessions: ProfessionKey[];
  };
  members: {
    id: string;
    name: string;
    avatar: string;
    profession: ProfessionKey;
    workshopLevel: number;
    /** Already played tonight's patrol (they gather at the campfire at night). */
    patrolled: boolean;
    nightClass: NightClassKey;
  }[];
  ranking: { week: RankingRow[]; lastWeek: RankingRow[]; allTime: RankingRow[] };
}

export async function loadGameState(userId: string): Promise<GameState | null> {
  const sql = db();
  const first = await getPlayer(userId);
  if (!first) return null;
  await resolveDueNights(first.farm_id);
  const player = (await getPlayer(userId))!;
  const now = new Date();
  const [[farm], inventory, progress, members, completed, seasons] = await Promise.all([
    sql<FarmRow[]>`SELECT * FROM farms WHERE id = ${player.farm_id}`,
    getInventory(sql, player.id),
    getProgress(sql, player.farm_id),
    sql<PlayerRow[]>`SELECT * FROM players WHERE farm_id = ${player.farm_id} ORDER BY created_at`,
    sql<{ building_key: string }[]>`
      SELECT building_key FROM farm_buildings WHERE farm_id = ${player.farm_id} ORDER BY completed_at`,
    sql<{ season: number; ended_night: number; ended_at: Date }[]>`
      SELECT season, ended_night, ended_at FROM seasons WHERE farm_id = ${player.farm_id} ORDER BY season DESC LIMIT 10`,
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

  const active = activeCount(members, now);
  const baseBuilding = currentBuilding(farm.level);
  const building = baseBuilding ? scaledBuilding(baseBuilding, active) : null;
  const tonight = farm.nights_survived + 1;
  const fireMax = fireMaxHp(active, farm.level);
  const fireHp = farm.fire_hp ?? fireMax;
  const team = teamFor(members, tonight, active);
  const defense = defenseOf(team, farm.level);
  const me = characterOf(player);
  const loadout = loadoutOf(player);
  const daily = await dailyRow(sql, player, farm.level, now);
  const todayTasks = tasksOf(player, daily, now);
  const professionCounts = countProfessions(members.map((m) => m.profession));
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
      coins: player.coins,
      energy: { now: energyOf(player, now), max: ENERGY.max, patrolCost: ENERGY.patrolCost },
      upgradeCost: workshopUpgradeCost(player.profession, player.workshop_level),
      professionChange: {
        cost: professionChangeCost(player.profession),
        availableAt: professionChangeAvailableAt(player.profession_changed_at, now)?.toISOString() ?? null,
      },
      character: {
        level: me.level,
        xpIntoLevel: Math.floor(me.xpIntoLevel),
        xpForNext: me.xpForNext,
        attributes: attributesOf(player),
        freePoints: attributePointsEarned(me.level) - ATTRIBUTE_KEYS.reduce((n, k) => n + attributesOf(player)[k], 0),
        talents: player.talents ?? [],
        bonuses: me.bonuses,
        nightClass: player.night_class,
        gear: SLOT_KEYS.map((slot) => {
          const it = loadout[slot]!;
          return {
            slot,
            tier: it.tier,
            refine: it.refine,
            value: Math.round(SLOTS[slot].perPower * (TIERS[it.tier].power + it.refine * SLOTS[slot].refineStep) * 100) / 100,
            upgradeCost: gearUpgradeCost(it.tier),
            refineCost: refineCost(it.refine),
          };
        }),
        power: {
          patrol: Math.round(residentPowerOf(player, true)),
          rest: Math.round(residentPowerOf(player, false)),
        },
      },
      patrolledTonight: player.patrol_night === tonight,
    },
    market: { limit: dailyBuyLimit(me.level), used: await boughtToday(sql, player.id, now) },
    tasks: {
      items: todayTasks.map((t, i) => ({
        kind: t.kind,
        text: t.text,
        target: t.target,
        progress: Math.min(t.target, daily[t.kind]),
        done: taskDone(t, daily),
        claimed: (daily.claimed & (1 << i)) !== 0,
        coins: t.coins,
        xp: t.xp,
      })),
      bonusCoins: allDoneBonus(daily.level),
      bonusClaimed: daily.bonus_claimed,
      claimable: todayTasks.some((t, i) => taskDone(t, daily) && (daily.claimed & (1 << i)) === 0),
    },
    night: {
      season: farm.season,
      night: tonight,
      nextAt: nextNightTime(now).toISOString(),
      fireHp,
      fireMax,
      horde: hordeStrength(tonight, active),
      defense,
      lasts: nightsFireLasts({ fromNight: tonight, activeMembers: active, defense, fireHp, fireMax, damageCutPct: team.damageCutPct }),
      team: {
        counts: team.counts,
        damageCutPct: team.damageCutPct,
        supportBoostPct: team.supportBoostPct,
        missing: team.missing,
      },
      myRole: roleOf(player),
      patrolled: members.filter((m) => m.patrol_night === tonight).length,
      expeditionsLeft: Math.max(0, PATROL.expeditionsPerDay - (await expeditionsToday(sql, player.id, now))),
      active,
      last: farm.last_night,
      seasons: seasons.map((x) => ({ season: x.season, endedNight: x.ended_night, endedAt: x.ended_at.toISOString() })),
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
      professionCounts,
      missingProfessions: missingProfessions(professionCounts),
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.display_name,
      avatar: m.avatar,
      profession: m.profession,
      workshopLevel: m.workshop_level,
      patrolled: m.patrol_night === tonight,
      nightClass: m.night_class,
    })),
    ranking: { week, lastWeek, allTime },
  };
}


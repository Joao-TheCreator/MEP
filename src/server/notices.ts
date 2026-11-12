import "server-only";
import { ENERGY, NOTIFY_KINDS, type NotifyKind } from "@/game/config";
import { dueNotifications, type Notice } from "@/game/notify";
import { storageHours } from "@/game/rules";
import { energyNow } from "@/game/tasks";
import { fireMaxHp } from "@/game/night";
import { db } from "./db";
import { activeCount, characterOf, resolvePendingNights, type CharacterRow, type LastNight, type NightFarmRow } from "./nights";
import { sendPush, type PushTarget } from "./push";

/**
 * Phone notices on the server (design §23): subscriptions, preferences and the
 * notify cron. Each (person, kind, key) is recorded in notifications_sent, so a
 * notice is sent at most once.
 */

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(playerId: string, sub: PushSubscriptionInput) {
  await db()`
    INSERT INTO push_subscriptions (player_id, endpoint, p256dh, auth)
    VALUES (${playerId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET player_id = EXCLUDED.player_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
}

export async function removeSubscription(playerId: string, endpoint: string) {
  await db()`DELETE FROM push_subscriptions WHERE player_id = ${playerId} AND endpoint = ${endpoint}`;
}

export async function setNotifyPref(playerId: string, kind: NotifyKind, on: boolean) {
  // only turned-off kinds are stored
  await db()`
    UPDATE players SET notify_prefs = CASE WHEN ${on}::boolean
      THEN notify_prefs - ${kind}::text
      ELSE notify_prefs || jsonb_build_object(${kind}::text, true) END
    WHERE id = ${playerId}`;
}

export async function notifyStateOf(playerId: string, prefs: Partial<Record<NotifyKind, boolean>> | null) {
  const [{ count }] = await db()<{ count: number }[]>`
    SELECT count(*)::int AS count FROM push_subscriptions WHERE player_id = ${playerId}`;
  const on = {} as Record<NotifyKind, boolean>;
  for (const k of NOTIFY_KINDS) on[k] = !prefs?.[k];
  return { devices: count, on };
}

type MemberRow = CharacterRow & {
  energy: number;
  energy_at: Date;
  notify_prefs: Partial<Record<NotifyKind, boolean>> | null;
};
type FarmRow = NightFarmRow & { last_night: LastNight | null };

export interface NotifyRunResult {
  farms: number;
  due: { playerId: string; notice: Notice }[];
  sent: number;
  gone: number;
}

/**
 * The notify cron: for every farm with a subscribed member, resolves the nights
 * that are due (so attacks happen on time even if nobody opens the game), then
 * sends the notices nobody got yet. `dry` lists them without sending or recording.
 */
export async function runNotify(now = new Date(), dry = false): Promise<NotifyRunResult> {
  const farms = await db()<{ id: string }[]>`
    SELECT DISTINCT p.farm_id AS id FROM push_subscriptions s JOIN players p ON p.id = s.player_id`;
  const result: NotifyRunResult = { farms: farms.length, due: [], sent: 0, gone: 0 };

  for (const { id } of farms) {
    const fresh = await db().begin(async (tx) => {
      const [farm] = await tx<FarmRow[]>`SELECT * FROM farms WHERE id = ${id} FOR UPDATE`;
      if (!farm) return [];
      const resolved = await resolvePendingNights(tx, farm, now);
      const lastNight = resolved ?? farm.last_night;
      const members = await tx<MemberRow[]>`SELECT * FROM players WHERE farm_id = ${id}`;
      const fireMax = fireMaxHp(activeCount(members, now), farm.level);
      const tonight = farm.nights_survived + 1;
      // only people with a subscribed device: someone who subscribes later still gets what is due then
      const subscribed = new Set(
        (await tx<{ player_id: string }[]>`
          SELECT DISTINCT s.player_id FROM push_subscriptions s JOIN players p ON p.id = s.player_id WHERE p.farm_id = ${id}`).map((r) => r.player_id),
      );
      const due: { playerId: string; notice: Notice }[] = [];
      for (const m of members.filter((x) => subscribed.has(x.id))) {
        const notices = dueNotifications(
          {
            lastCollectedAt: m.last_collected_at,
            storageHours: storageHours(farm.level),
            patrolledTonight: m.patrol_night === tonight,
            energy: energyNow(m.energy, m.energy_at, now, characterOf(m).bonuses.energyRegenPct),
            patrolCost: ENERGY.patrolCost,
            tonight,
            lastNight: lastNight ? { night: lastNight.night, season: lastNight.season, wiped: lastNight.wiped, fireHp: lastNight.fireHp, at: lastNight.at } : null,
            fireMax,
            off: m.notify_prefs ?? {},
          },
          now,
        );
        for (const notice of notices) {
          if (dry) {
            const [seen] = await tx`SELECT 1 FROM notifications_sent WHERE player_id = ${m.id} AND kind = ${notice.kind} AND key = ${notice.key}`;
            if (!seen) due.push({ playerId: m.id, notice });
            continue;
          }
          const inserted = await tx`
            INSERT INTO notifications_sent (player_id, kind, key) VALUES (${m.id}, ${notice.kind}, ${notice.key})
            ON CONFLICT DO NOTHING RETURNING 1`;
          if (inserted.length) due.push({ playerId: m.id, notice });
        }
      }
      return due;
    });
    result.due.push(...fresh);
  }
  if (dry) return result;

  // send after the transactions, so a slow push service never holds a farm lock
  for (const { playerId, notice } of result.due) {
    const subs = await db()<(PushTarget & { id: string })[]>`
      SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE player_id = ${playerId}`;
    for (const s of subs) {
      const r = await sendPush(s, { title: notice.title, body: notice.body, url: notice.url, tag: notice.kind });
      if (r === "sent") result.sent++;
      if (r === "gone") {
        result.gone++;
        await db()`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
      }
    }
  }
  return result;
}

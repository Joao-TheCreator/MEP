/**
 * Phone notices (design §23). Pure: given one resident's state, which notices
 * are due now. The notify cron sends each (kind, key) at most once per person,
 * so a notice that stays due is not repeated.
 */
import { NIGHT, NOTIFY, type NotifyKind } from "./config";

export interface NotifyInput {
  lastCollectedAt: Date;
  /** Storage size of the farm, in hours. */
  storageHours: number;
  patrolledTonight: boolean;
  energy: number;
  patrolCost: number;
  /** Night that attacks next. */
  tonight: number;
  /** The last attack, as stored on the farm (null before the first). */
  lastNight: { night: number; season: number; wiped: boolean; fireHp: number; at: string } | null;
  fireMax: number;
  /** Kinds the person turned off. */
  off?: Partial<Record<NotifyKind, boolean>>;
}

export interface Notice {
  kind: NotifyKind;
  /** Identifies this occurrence: (kind, key) is sent only once. */
  key: string;
  title: string;
  body: string;
  /** Where a tap on the notice opens the game. */
  url: string;
}

/** Hour of the day in Brasília (UTC−3, no daylight saving). */
export function brasiliaHour(now: Date): number {
  return (now.getUTCHours() + 21) % 24;
}

export function isQuietHour(now: Date): boolean {
  const h = brasiliaHour(now);
  return NOTIFY.quietFromHour > NOTIFY.quietToHour
    ? h >= NOTIFY.quietFromHour || h < NOTIFY.quietToHour
    : h >= NOTIFY.quietFromHour && h < NOTIFY.quietToHour;
}

export function dueNotifications(i: NotifyInput, now: Date): Notice[] {
  if (isQuietHour(now)) return [];
  const out: Notice[] = [];
  const hour = brasiliaHour(now);

  if (now.getTime() >= i.lastCollectedAt.getTime() + i.storageHours * 3_600_000) {
    out.push({
      kind: "storage_full",
      key: i.lastCollectedAt.toISOString(),
      title: "Seu armazém encheu",
      body: "A produção parou. Venha coletar!",
      url: "/",
    });
  }

  if (hour >= NOTIFY.hordeFromHour && hour < NIGHT.hour && !i.patrolledTonight && i.energy >= i.patrolCost) {
    out.push({
      kind: "horde",
      key: String(i.tonight),
      title: `A horda da noite ${i.tonight} chega às ${NIGHT.hour}h`,
      body: "Faça sua ronda para defender a fogueira com força total!",
      url: "/?tab=night",
    });
  }

  const last = i.lastNight;
  const recent = last && now.getTime() - new Date(last.at).getTime() <= NOTIFY.nightNoticeHours * 3_600_000;
  if (last && recent && last.wiped) {
    out.push({
      kind: "wipe",
      key: String(last.season),
      title: "A fogueira apagou",
      body: `O sítio caiu na noite ${last.night}. Nova temporada: os itens ficaram com vocês!`,
      url: "/?tab=night",
    });
  } else if (last && recent && i.fireMax > 0) {
    const pct = Math.round((last.fireHp / i.fireMax) * 100);
    if (pct < NOTIFY.fireLowPct) {
      out.push({
        kind: "fire_low",
        key: `${last.season}-${last.night}`,
        title: `A fogueira está com ${pct}% de vida`,
        body: "Mais uma noite assim e ela apaga. Combinem a ronda e reforcem a defesa!",
        url: "/?tab=night",
      });
    }
  }

  return out.filter((n) => !i.off?.[n.kind]);
}

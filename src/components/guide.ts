/**
 * Gameplay feel (roadmap 1c), pure helpers: the "next step" hint shown at the
 * top of the game, and the reward pops that float up after an action.
 */

export type GuideTab = "farm" | "work" | "hero" | "night" | "barn";

export interface Hint {
  text: string;
  tab: GuideTab;
  /** Urgent hints are drawn in the flame color. */
  urgent?: boolean;
}

export interface HintInput {
  /** Units waiting in the storage, and its capacity. */
  pending: number;
  capacity: number;
  resourceName: string;
  /** Hour of the day in Brasília (with fraction). */
  hour: number;
  patrolled: boolean;
  hordeBeatsDefense: boolean;
  nightsFireLasts: number | null;
  freeAttributePoints: number;
  /** A talent tier is open and not chosen yet. */
  talentToPick: boolean;
  /** Label of a gear slot the player can upgrade or refine right now, if any. */
  gearReady: string | null;
  canUpgradeWorkshop: boolean;
  workshopName: string;
  /** Name of the building under construction when the player holds something it needs. */
  canDonateTo: string | null;
  /** A daily task is finished and its reward was not claimed yet. */
  taskReward: boolean;
  /** Name of a night role nobody is playing tonight (tank or support), if the player could still switch. */
  missingRole: string | null;
  /** The backpack has something better than what is worn. */
  betterInBag: boolean;
}

/** The single most useful thing to do now. The order below is the priority. */
export function nextStep(i: HintInput): Hint {
  if (i.capacity > 0 && i.pending >= i.capacity) {
    return { text: `Armazém cheio! Colete ${i.resourceName} para não perder.`, tab: "work", urgent: true };
  }
  const beforeAttack = i.hour >= 6 && i.hour < 20;
  if (!i.patrolled && beforeAttack && i.nightsFireLasts === 1) {
    return { text: "A fogueira apaga hoje! Faça a ronda antes das 20h.", tab: "night", urgent: true };
  }
  if (!i.patrolled && beforeAttack && i.hordeBeatsDefense && i.hour >= 12) {
    return { text: "A horda de hoje passa da defesa. Faça a ronda antes das 20h.", tab: "night", urgent: true };
  }
  if (i.taskReward) return { text: "Tarefa do dia pronta. Receba a recompensa.", tab: "work" };
  if (i.freeAttributePoints > 0) {
    return { text: `Você tem ${i.freeAttributePoints} ponto${i.freeAttributePoints > 1 ? "s" : ""} de atributo para usar.`, tab: "hero" };
  }
  if (i.betterInBag) return { text: "Tem item melhor na mochila. Equipe no Herói.", tab: "hero" };
  if (i.talentToPick) return { text: "Novo talento liberado. Escolha o seu.", tab: "hero" };
  if (i.gearReady) return { text: `Dá para melhorar: ${i.gearReady}.`, tab: "hero" };
  if (i.canUpgradeWorkshop) return { text: `Dá para melhorar ${i.workshopName}.`, tab: "work" };
  if (i.canDonateTo) return { text: `Você tem material para a obra: ${i.canDonateTo}.`, tab: "farm" };
  if (i.capacity > 0 && i.pending >= i.capacity * 0.5) {
    return { text: `Colete sua produção: ${i.pending} de ${i.resourceName}.`, tab: "work" };
  }
  if (!i.patrolled && beforeAttack && i.missingRole) {
    return { text: `Ninguém de ${i.missingRole} hoje. Dá para trocar de classe no Herói.`, tab: "hero" };
  }
  if (!i.patrolled && beforeAttack) return { text: "Faça a ronda de hoje para defender com força total.", tab: "night" };
  return { text: "Tudo em dia. A produção segue enquanto você descansa.", tab: "farm" };
}

export interface Snapshot {
  season: number;
  coins: number;
  level: number;
  xpIntoLevel: number;
  farmLevel: number;
  inventory: Record<string, number>;
}

export interface Pop {
  text: string;
  /** Big pops (level ups) get more room and stay longer. */
  big?: boolean;
  /** Resource key, to draw its icon. */
  resource?: string;
  coin?: boolean;
}

/** What the player just gained, comparing the game state before and after an action. */
export function rewardPops(prev: Snapshot, next: Snapshot, names: Record<string, string>): Pop[] {
  if (next.season !== prev.season) return []; // a wipe is not a reward
  const pops: Pop[] = [];
  if (next.farmLevel > prev.farmLevel) pops.push({ text: `Sítio nível ${next.farmLevel}!`, big: true });
  if (next.level > prev.level) pops.push({ text: `Nível ${next.level}!`, big: true });
  else if (next.xpIntoLevel > prev.xpIntoLevel) pops.push({ text: `+${next.xpIntoLevel - prev.xpIntoLevel} XP` });
  if (next.coins > prev.coins) pops.push({ text: `+${next.coins - prev.coins}`, coin: true });
  const gains = Object.keys(next.inventory)
    .map((k) => ({ k, d: (next.inventory[k] ?? 0) - (prev.inventory[k] ?? 0) }))
    .filter((g) => g.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, 3);
  for (const g of gains) pops.push({ text: `+${g.d} ${names[g.k] ?? g.k}`, resource: g.k });
  return pops;
}

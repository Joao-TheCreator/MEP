/**
 * Character progression (design §11–§12): level and XP, attributes, talent tree
 * and gear tiers. Pure functions only; numbers live in ./config.
 */
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTES,
  BONUS_CAPS,
  GEAR,
  LEVEL,
  MAX_ATTRIBUTE_POINTS,
  TALENTS,
  TIER_KEYS,
  TIERS,
  XP_PER_POINT,
  type AttributeKey,
  type Bag,
  type BonusBag,
  type BonusKey,
  type CharacterBonuses,
  type ProfessionKey,
  type ResourceKey,
  type Talent,
  type TierKey,
} from "./config";

// ---------- level & XP ----------

/** XP needed to go from `level` to `level + 1` (null at max level). */
export function xpToNext(level: number): number | null {
  if (level >= LEVEL.maxLevel) return null;
  return Math.round(LEVEL.baseXp * Math.pow(LEVEL.xpGrowth, level - 1));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, LEVEL.maxLevel); l++) sum += xpToNext(l)!;
  return sum;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total (null at max level). */
  xpForNext: number | null;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  for (;;) {
    const need = xpToNext(level);
    if (need === null) return { level, xpIntoLevel: 0, xpForNext: null };
    if (rest < need) return { level, xpIntoLevel: rest, xpForNext: need };
    rest -= need;
    level++;
  }
}

/** XP earned for an action that moved `points` of value. */
export function xpFor(action: keyof typeof XP_PER_POINT, points: number): number {
  return Math.floor(points * XP_PER_POINT[action]);
}

// ---------- attributes ----------

export type Attributes = Record<AttributeKey, number>;

export function emptyAttributes(): Attributes {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Attributes;
}

export function attributePointsEarned(level: number): number {
  return (Math.min(level, LEVEL.maxLevel) - 1) * LEVEL.attributePointsPerLevel;
}

export function attributePointsSpent(attrs: Attributes): number {
  return ATTRIBUTE_KEYS.reduce((s, k) => s + attrs[k], 0);
}

/** Why these attributes are not allowed at this level, or null when they are. */
export function attributesError(attrs: Attributes, level: number): string | null {
  for (const k of ATTRIBUTE_KEYS) {
    const v = attrs[k];
    if (!Number.isInteger(v) || v < 0) return `${ATTRIBUTES[k].name} inválida.`;
    if (v > MAX_ATTRIBUTE_POINTS) return `${ATTRIBUTES[k].name} vai até ${MAX_ATTRIBUTE_POINTS}.`;
  }
  if (attributePointsSpent(attrs) > attributePointsEarned(level)) return "Pontos de atributo insuficientes.";
  return null;
}

// ---------- talents ----------

/** How many talent tiers are open at this level. */
export function talentTiersOpen(level: number): number {
  return LEVEL.talentLevels.filter((l) => level >= l).length;
}

/** Picks per tier: 0 or 1 (the option chosen) or null (not chosen yet). */
export type TalentPicks = (0 | 1 | null)[];

export function talentsError(profession: ProfessionKey, picks: TalentPicks, level: number): string | null {
  const tree = TALENTS[profession];
  if (picks.length > tree.length) return "Talento inválido.";
  const open = talentTiersOpen(level);
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    if (p === null) continue;
    if (p !== 0 && p !== 1) return "Talento inválido.";
    if (i >= open) return `Esse talento abre no nível ${LEVEL.talentLevels[i]}.`;
  }
  return null;
}

export function chosenTalents(profession: ProfessionKey, picks: TalentPicks): Talent[] {
  const tree = TALENTS[profession];
  return picks.flatMap((p, i) => (p === null || !tree[i] ? [] : [tree[i][p]]));
}

// ---------- gear ----------

export function tierIndex(tier: TierKey): number {
  return TIER_KEYS.indexOf(tier);
}

export function nextTier(tier: TierKey): TierKey | null {
  return TIER_KEYS[tierIndex(tier) + 1] ?? null;
}

/** Cost to upgrade an item from `tier` to the next one (null at the top or when locked). */
export function gearUpgradeCost(tier: TierKey): Bag | null {
  const next = nextTier(tier);
  if (!next || TIERS[next].locked) return null;
  const factor = Math.pow(GEAR.upgradeCostGrowth, tierIndex(tier));
  const out: Bag = {};
  for (const [k, v] of Object.entries(GEAR.baseUpgradeCost) as [ResourceKey, number][]) {
    out[k] = Math.ceil(Math.round(v * factor * 1e6) / 1e6);
  }
  return out;
}

/** Work tools boost production; night weapons boost damage. */
export function gearBonus(kind: "tool" | "weapon", tier: TierKey): BonusBag {
  const power = TIERS[tier].power;
  return kind === "tool" ? { productionPct: power } : { damagePct: power };
}

// ---------- totals ----------

const BONUS_KEYS = Object.keys(BONUS_CAPS) as BonusKey[];

export function emptyBonuses(): CharacterBonuses {
  return Object.fromEntries(BONUS_KEYS.map((k) => [k, 0])) as unknown as CharacterBonuses;
}

export interface CharacterBuild {
  profession: ProfessionKey;
  attributes: Attributes;
  talents: TalentPicks;
  toolTier: TierKey;
  weaponTier: TierKey;
}

/** All personal bonuses added up and capped (BONUS_CAPS). */
export function characterBonuses(build: CharacterBuild): CharacterBonuses {
  const total = emptyBonuses();
  const add = (bag: BonusBag, times = 1) => {
    for (const [k, v] of Object.entries(bag) as [BonusKey, number][]) total[k] += v * times;
  };
  for (const k of ATTRIBUTE_KEYS) add(ATTRIBUTES[k].perPoint, build.attributes[k]);
  for (const t of chosenTalents(build.profession, build.talents)) add(t.bonus);
  add(gearBonus("tool", build.toolTier));
  add(gearBonus("weapon", build.weaponTier));
  for (const k of BONUS_KEYS) total[k] = Math.min(BONUS_CAPS[k], Math.round(total[k] * 100) / 100);
  return total;
}

/**
 * Extra units from `craftExtraPct` for a batch of `times`: the expected value,
 * with the fractional part decided by one roll (`roll` in [0, 1)).
 */
export function craftExtraUnits(times: number, craftExtraPct: number, roll: number): number {
  const expected = (times * craftExtraPct) / 100;
  const whole = Math.floor(expected);
  return whole + (roll < expected - whole ? 1 : 0);
}

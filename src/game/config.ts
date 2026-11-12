/**
 * Game balance — single source of truth for every number in the game.
 * Keep in sync with docs/design.md (same commit!).
 */

export const RESOURCES = {
  grain: { name: "Grãos", emoji: "🌾", points: 1 },
  milk: { name: "Leite", emoji: "🥛", points: 2 },
  wood: { name: "Madeira", emoji: "🪵", points: 1 },
  ore: { name: "Minério", emoji: "🪨", points: 2 },
  feed: { name: "Ração", emoji: "🌽", points: 6 },
  cheese: { name: "Queijo", emoji: "🧀", points: 10 },
  plank: { name: "Tábua", emoji: "🪚", points: 4 },
  iron_bar: { name: "Barra de ferro", emoji: "🔩", points: 10 },
  tool: { name: "Ferramenta", emoji: "🛠️", points: 29 },
} as const;

export type ResourceKey = keyof typeof RESOURCES;
export const RESOURCE_KEYS = Object.keys(RESOURCES) as ResourceKey[];
export type Bag = Partial<Record<ResourceKey, number>>;

export type ProfessionKey = "farmer" | "rancher" | "carpenter" | "blacksmith";

export interface Profession {
  name: string;
  emoji: string;
  description: string;
  produces: ResourceKey;
  /** Base production in units per hour at workshop level 1, farm level 1. */
  baseRatePerHour: number;
  workshop: { name: string; baseCost: Bag };
}

export const PROFESSIONS: Record<ProfessionKey, Profession> = {
  farmer: {
    name: "Agricultor",
    emoji: "👩‍🌾",
    description: "Planta grãos e prepara ração para os animais.",
    produces: "grain",
    baseRatePerHour: 60,
    workshop: { name: "Arado", baseCost: { plank: 20, tool: 2, grain: 100 } },
  },
  rancher: {
    name: "Pecuarista",
    emoji: "🐄",
    description: "Cuida dos animais, tira leite e faz queijo.",
    produces: "milk",
    baseRatePerHour: 30,
    workshop: { name: "Curral", baseCost: { plank: 30, feed: 20, milk: 60 } },
  },
  carpenter: {
    name: "Carpinteiro",
    emoji: "🪓",
    description: "Corta madeira e serra tábuas para tudo no sítio.",
    produces: "wood",
    baseRatePerHour: 60,
    workshop: { name: "Serraria", baseCost: { iron_bar: 5, tool: 3, wood: 100 } },
  },
  blacksmith: {
    name: "Ferreiro",
    emoji: "⚒️",
    description: "Extrai minério e forja barras e ferramentas.",
    produces: "ore",
    baseRatePerHour: 30,
    workshop: { name: "Forja", baseCost: { plank: 20, cheese: 10, ore: 60 } },
  },
};

export const PROFESSION_KEYS = Object.keys(PROFESSIONS) as ProfessionKey[];

/**
 * Changing profession (design §2.1). The cost is paid in the CURRENT profession's
 * raw resource, so anyone can afford it without help from the others: costHours
 * of base production (= costHours × 60 points for every profession).
 */
export const PROFESSION_CHANGE = {
  costHours: 4,
  cooldownHours: 24,
} as const;

export interface Recipe {
  name: string;
  profession: ProfessionKey;
  inputs: Bag;
  output: ResourceKey;
}

export const RECIPES = {
  feed: { name: "Ração", profession: "farmer", inputs: { grain: 5 }, output: "feed" },
  cheese: { name: "Queijo", profession: "rancher", inputs: { milk: 4 }, output: "cheese" },
  plank: { name: "Tábua", profession: "carpenter", inputs: { wood: 3 }, output: "plank" },
  iron_bar: {
    name: "Barra de ferro",
    profession: "blacksmith",
    inputs: { ore: 3, wood: 2 },
    output: "iron_bar",
  },
  tool: {
    name: "Ferramenta",
    profession: "blacksmith",
    inputs: { iron_bar: 2, plank: 1 },
    output: "tool",
  },
} as const satisfies Record<string, Recipe>;

export type RecipeKey = keyof typeof RECIPES;
export const RECIPE_KEYS = Object.keys(RECIPES) as RecipeKey[];

export const WORKSHOP = {
  maxLevel: 10,
  /** Each workshop level adds this % of the base rate. */
  bonusPercentPerLevel: 25,
  /** Cost multiplier per level (applied as 1.6^(level-1)). */
  costGrowth: 1.6,
} as const;

export const FARM = {
  /** Each farm level adds this % to everyone's production. */
  bonusPercentPerLevel: 10,
  baseStorageHours: 8,
  maxMembers: 30,
} as const;

export interface Building {
  key: string;
  name: string;
  description: string;
  /** Farm level required to work on this building (it raises the farm to level + 1). */
  fromLevel: number;
  cost: Bag;
  effect: { storageHoursBonus?: number };
}

export const BUILDINGS: Building[] = [
  {
    key: "well",
    name: "Poço Comunitário",
    description: "Água para todo mundo. O sítio sobe para o nível 2 (+10% de produção).",
    fromLevel: 1,
    cost: { wood: 400, ore: 200, grain: 300, plank: 60 },
    effect: {},
  },
  {
    key: "barn",
    name: "Celeiro",
    description: "Mais espaço para guardar: armazém offline de 8 h para 12 h e +10% de produção.",
    fromLevel: 2,
    cost: { grain: 800, milk: 300, plank: 200, feed: 120, iron_bar: 60 },
    effect: { storageHoursBonus: 4 },
  },
  {
    key: "mill",
    name: "Moinho",
    description: "Moagem para o sítio inteiro. Sítio nível 4 (+10% de produção).",
    fromLevel: 3,
    cost: { plank: 300, feed: 300, cheese: 120, iron_bar: 100, tool: 40 },
    effect: {},
  },
];

/** Building costs above are for this many active members; bigger farms pay proportionally (#4). */
export const BUILDING_SCALE = { referenceMembers: 5 } as const;

export const MAX_FARM_LEVEL = BUILDINGS.length + 1;

/** Ranking weeks start Monday 00:00 in this timezone. */
export const RANKING_TIMEZONE = "America/Sao_Paulo";

// ============================================================================
// Character progression (design §11–§12): level, attributes, talents, gear.
// ============================================================================

/** Personal bonuses, summed from attributes, talents and gear (all additive). */
export interface CharacterBonuses {
  /** Day: +% on your passive production. */
  productionPct: number;
  /** Day: extra minutes before your storage fills up. */
  storageMinutes: number;
  /** Day: % of crafted units that come out doubled. */
  craftExtraPct: number;
  /** Day: +% of what you donate that counts toward the building (not ranking points). */
  donationProgressPct: number;
  /** Day/night: +% energy recovered per hour. */
  energyRegenPct: number;
  /** Night (#14): +% damage. */
  damagePct: number;
  /** Night: +% health. */
  healthPct: number;
  /** Night: +% attack speed. */
  attackSpeedPct: number;
  /** Night: +% special-power charge. */
  specialChargePct: number;
  /** Night: +% healing done to others. */
  healPct: number;
}
export type BonusKey = keyof CharacterBonuses;
export type BonusBag = Partial<CharacterBonuses>;

/** Hard caps so personal power can't run away from the farm economy. */
export const BONUS_CAPS: CharacterBonuses = {
  productionPct: 100,
  storageMinutes: 360,
  craftExtraPct: 50,
  donationProgressPct: 60,
  energyRegenPct: 100,
  /** Proposal §15.5 (were 200 and 150): room for refined gear to keep mattering. */
  damagePct: 600,
  healthPct: 400,
  attackSpeedPct: 80,
  specialChargePct: 100,
  healPct: 150,
};

export const LEVEL = {
  maxLevel: 30,
  /** XP to go from level 1 to 2; each next level costs `xpGrowth` times more. */
  baseXp: 100,
  /** Proposal §15.5 (was 1.2): slower, so the level still matters when the horde catches up. */
  xpGrowth: 1.25,
  attributePointsPerLevel: 1,
  /** A talent tier opens at each of these levels. */
  talentLevels: [5, 10, 15, 20] as const,
} as const;

/**
 * XP per point of value moved by each action. Sending to a friend gives no XP
 * (two friends could send back and forth forever).
 */
export const XP_PER_POINT = {
  collect: 0.1,
  craft: 0.5,
  donate: 1,
} as const;

export const ENERGY = {
  max: 100,
  regenPerHour: 10,
  /** Energy spent by each night patrol (design §17). */
  patrolCost: 30,
} as const;

export type AttributeKey = "strength" | "endurance" | "agility" | "craft" | "spirit";

export interface Attribute {
  name: string;
  short: string;
  description: string;
  /** Bonuses granted by EACH point. */
  perPoint: BonusBag;
}

export const ATTRIBUTES: Record<AttributeKey, Attribute> = {
  strength: {
    name: "Força", short: "FOR",
    description: "Trabalha mais pesado de dia e bate mais forte à noite.",
    perPoint: { productionPct: 1.5, damagePct: 3 },
  },
  endurance: {
    name: "Resistência", short: "RES",
    description: "Aguenta mais tempo longe do jogo e apanha sem desmaiar.",
    perPoint: { storageMinutes: 12, healthPct: 4 },
  },
  agility: {
    name: "Agilidade", short: "AGI",
    description: "Recupera energia mais rápido e ataca mais rápido.",
    perPoint: { energyRegenPct: 3, attackSpeedPct: 2 },
  },
  craft: {
    name: "Ofício", short: "OFI",
    description: "Mão caprichada: às vezes fabrica em dobro. Carrega o poder especial mais rápido.",
    perPoint: { craftExtraPct: 1.5, specialChargePct: 3 },
  },
  spirit: {
    name: "Espírito", short: "ESP",
    description: "Anima o grupo: suas doações rendem mais na obra, e cura os amigos à noite.",
    perPoint: { donationProgressPct: 2, healPct: 4 },
  },
};
export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTES) as AttributeKey[];
export const MAX_ATTRIBUTE_POINTS = 20;

export interface Talent {
  key: string;
  name: string;
  description: string;
  bonus: BonusBag;
}

/**
 * Talent tree: per profession, one tier per LEVEL.talentLevels entry, two choices
 * per tier ([for yourself, for the group]). Pick one per tier.
 */
export const TALENTS: Record<ProfessionKey, [Talent, Talent][]> = {
  farmer: [
    [
      { key: "farmer.good-hand", name: "Mão boa", description: "+8% de produção.", bonus: { productionPct: 8 } },
      { key: "farmer.big-harvest", name: "Colheita farta", description: "+60 min de armazém.", bonus: { storageMinutes: 60 } },
    ],
    [
      { key: "farmer.fine-feed", name: "Ração caprichada", description: "+6% de chance de fabricar em dobro.", bonus: { craftExtraPct: 6 } },
      { key: "farmer.first-fruits", name: "Primícias", description: "Suas doações rendem +6% na obra.", bonus: { donationProgressPct: 6 } },
    ],
    [
      { key: "farmer.sun-to-sun", name: "De sol a sol", description: "+12% de produção.", bonus: { productionPct: 12 } },
      { key: "farmer.work-party", name: "Mutirão", description: "Suas doações rendem +10% na obra.", bonus: { donationProgressPct: 10 } },
    ],
    [
      { key: "farmer.record-crop", name: "Safra recorde", description: "+15% de produção e +60 min de armazém.", bonus: { productionPct: 15, storageMinutes: 60 } },
      { key: "farmer.peoples-barn", name: "Celeiro do povo", description: "Suas doações rendem +15% na obra.", bonus: { donationProgressPct: 15 } },
    ],
  ],
  rancher: [
    [
      { key: "rancher.early-milking", name: "Ordenha cedo", description: "+8% de produção.", bonus: { productionPct: 8 } },
      { key: "rancher.wide-pasture", name: "Pasto largo", description: "+60 min de armazém.", bonus: { storageMinutes: 60 } },
    ],
    [
      { key: "rancher.aged-cheese", name: "Queijo curado", description: "+6% de chance de fabricar em dobro.", bonus: { craftExtraPct: 6 } },
      { key: "rancher.milk-for-all", name: "Leite pro vizinho", description: "Suas doações rendem +6% na obra.", bonus: { donationProgressPct: 6 } },
    ],
    [
      { key: "rancher.full-pen", name: "Curral cheio", description: "+12% de produção.", bonus: { productionPct: 12 } },
      { key: "rancher.cheese-fest", name: "Festa do queijo", description: "Suas doações rendem +10% na obra.", bonus: { donationProgressPct: 10 } },
    ],
    [
      { key: "rancher.prize-herd", name: "Rebanho premiado", description: "+15% de produção e +60 min de armazém.", bonus: { productionPct: 15, storageMinutes: 60 } },
      { key: "rancher.farm-dairy", name: "Leiteria do sítio", description: "Suas doações rendem +15% na obra.", bonus: { donationProgressPct: 15 } },
    ],
  ],
  carpenter: [
    [
      { key: "carpenter.sharp-axe", name: "Machado afiado", description: "+8% de produção.", bonus: { productionPct: 8 } },
      { key: "carpenter.woodpile", name: "Lenha estocada", description: "+60 min de armazém.", bonus: { storageMinutes: 60 } },
    ],
    [
      { key: "carpenter.fine-saw", name: "Serra fina", description: "+6% de chance de fabricar em dobro.", bonus: { craftExtraPct: 6 } },
      { key: "carpenter.main-beam", name: "Viga mestra", description: "Suas doações rendem +6% na obra.", bonus: { donationProgressPct: 6 } },
    ],
    [
      { key: "carpenter.deep-woods", name: "Mata adentro", description: "+12% de produção.", bonus: { productionPct: 12 } },
      { key: "carpenter.fence-party", name: "Mutirão da cerca", description: "Suas doações rendem +10% na obra.", bonus: { donationProgressPct: 10 } },
    ],
    [
      { key: "carpenter.master", name: "Mestre carpinteiro", description: "+15% de produção e +60 min de armazém.", bonus: { productionPct: 15, storageMinutes: 60 } },
      { key: "carpenter.architect", name: "Arquiteto do sítio", description: "Suas doações rendem +15% na obra.", bonus: { donationProgressPct: 15 } },
    ],
  ],
  blacksmith: [
    [
      { key: "blacksmith.firm-pick", name: "Picareta firme", description: "+8% de produção.", bonus: { productionPct: 8 } },
      { key: "blacksmith.deep-vein", name: "Veio fundo", description: "+60 min de armazém.", bonus: { storageMinutes: 60 } },
    ],
    [
      { key: "blacksmith.hot-forge", name: "Forja quente", description: "+6% de chance de fabricar em dobro.", bonus: { craftExtraPct: 6 } },
      { key: "blacksmith.gift-tool", name: "Ferramenta de presente", description: "Suas doações rendem +6% na obra.", bonus: { donationProgressPct: 6 } },
    ],
    [
      { key: "blacksmith.tireless-anvil", name: "Bigorna incansável", description: "+12% de produção.", bonus: { productionPct: 12 } },
      { key: "blacksmith.peoples-smith", name: "Ferreiro do povo", description: "Suas doações rendem +10% na obra.", bonus: { donationProgressPct: 10 } },
    ],
    [
      { key: "blacksmith.master", name: "Mestre ferreiro", description: "+15% de produção e +60 min de armazém.", bonus: { productionPct: 15, storageMinutes: 60 } },
      { key: "blacksmith.temple-steel", name: "Aço do templo", description: "Suas doações rendem +15% na obra.", bonus: { donationProgressPct: 15 } },
    ],
  ],
};

/** Gear tiers, from the free starting item up to the legendary Ember (Brasa). */
export type TierKey = "wood" | "bronze" | "iron" | "silver" | "gold" | "diamond" | "ember";

export interface Tier {
  name: string;
  /** Bonus % the item gives at this tier (production for tools, damage for weapons). */
  power: number;
  color: string;
  /** Not craftable yet: needs the group's Brasas (#17). */
  locked?: boolean;
}

export const TIERS: Record<TierKey, Tier> = {
  wood: { name: "Madeira", power: 0, color: "#a8703f" },
  bronze: { name: "Bronze", power: 4, color: "#c07a3a" },
  iron: { name: "Ferro", power: 8, color: "#8d887d" },
  silver: { name: "Prata", power: 13, color: "#c9ced6" },
  gold: { name: "Ouro", power: 19, color: "#e2b33c" },
  diamond: { name: "Diamante", power: 26, color: "#6cc5d6" },
  ember: { name: "Brasa", power: 34, color: "#de4a47", locked: true },
};
export const TIER_KEYS = Object.keys(TIERS) as TierKey[];

export const GEAR = {
  /** Cost to upgrade from tier 0 (Madeira) to tier 1 (Bronze). */
  baseUpgradeCost: { plank: 10, iron_bar: 4, tool: 1 } as Bag,
  /** Each next tier costs this many times more. */
  upgradeCostGrowth: 1.9,
} as const;

/** Day tool of each profession (boosts production). */
export const WORK_TOOLS: Record<ProfessionKey, { name: string }> = {
  farmer: { name: "Enxada" },
  rancher: { name: "Balde" },
  carpenter: { name: "Machado" },
  blacksmith: { name: "Martelo" },
};

/** Night classes from #14 and their weapons (boost damage). */
export type NightClassKey = "volley" | "mattress" | "guitar" | "cook" | "lantern";
export const NIGHT_WEAPONS: Record<NightClassKey, { className: string; name: string }> = {
  volley: { className: "Jogador de vôlei", name: "Bola de vôlei" },
  mattress: { className: "Colchonete", name: "Colchonete" },
  guitar: { className: "Violão", name: "Violão" },
  cook: { className: "Cozinheira", name: "Concha" },
  lantern: { className: "Lanterna", name: "Lanterna" },
};

/** Equipment slots around the character (design §12). */
export type SlotKey = "hat" | "body" | "hands" | "feet" | "tool" | "weapon" | "pin" | "bracelet";

export interface Slot {
  label: string;
  /** Item name (tool and weapon names come from WORK_TOOLS / NIGHT_WEAPONS). */
  itemName?: string;
  /** Which personal bonus the item raises. */
  stat: BonusKey;
  /** Bonus = perPower × (tier power + refine × refineStep). */
  perPower: number;
  refineStep: number;
}

export const SLOTS: Record<SlotKey, Slot> = {
  hat: { label: "Cabeça", itemName: "Chapéu de palha", stat: "storageMinutes", perPower: 3, refineStep: 1 },
  body: { label: "Corpo", itemName: "Camiseta do acampamento", stat: "healthPct", perPower: 1, refineStep: 1 },
  hands: { label: "Mãos", itemName: "Luvas de trabalho", stat: "craftExtraPct", perPower: 0.25, refineStep: 1 },
  feet: { label: "Pés", itemName: "Botina", stat: "energyRegenPct", perPower: 0.5, refineStep: 1 },
  tool: { label: "Ferramenta", stat: "productionPct", perPower: 1, refineStep: 1 },
  weapon: { label: "Arma", stat: "damagePct", perPower: 1, refineStep: 2 },
  pin: { label: "Broche", itemName: "Broche da chama", stat: "donationProgressPct", perPower: 0.3, refineStep: 1 },
  bracelet: { label: "Pulseira", itemName: "Pulseira de miçangas", stat: "specialChargePct", perPower: 0.5, refineStep: 1 },
};
export const SLOT_KEYS = Object.keys(SLOTS) as SlotKey[];

export const REFINE = {
  /** Proposal (§15.5): no real ceiling, so gear keeps being worth working for. */
  maxLevel: 99,
  /** Cost to refine from +r to +(r+1): ceil(value × (r + 1) × costGrowth^r) of each resource. */
  costPerLevel: { iron_bar: 2, tool: 0.5 } as Bag,
  /** Each refine level costs this many times more than the linear step (1 = linear). */
  costGrowth: 1.18,
} as const;

export const BAG = {
  slotsPerPage: 24,
  /** Level needed to open each page of the backpack. */
  pageUnlockLevels: [1, 1, 15] as const,
} as const;

// ============================================================================
// Night hordes and the wipe (design §15, proposal): every night the horde
// attacks the campfire; it grows each night. If the fire goes out, the farm
// is wiped and a new season starts; only the items (gear) are kept.
// ============================================================================

export const NIGHT = {
  /** The horde attacks every night at this hour (RANKING_TIMEZONE). */
  hour: 20,
  /** Horde strength on night 1, per active member of the farm. */
  baseHordePerMember: 14,
  /** Each night the horde is this many times stronger. */
  growthPerNight: 1.1,
  /** Members count as active if they collected in the last this-many hours. */
  activeWindowHours: 72,
  /** The horde never scales below this many members (small groups). */
  minMembersForHorde: 4,
} as const;

/** A resident's strength at night (design §15.2). */
export const COMBAT = {
  /** Power of a level-1 resident with no gear. */
  basePower: 10,
  /** Extra power per character level above 1. */
  powerPerLevel: 1,
  /** Multiplier for those who played the night patrol (ronda) before the attack. */
  patrolMultiplier: 1.5,
  /** Multiplier for those who did not: their gear still helps, asleep in the tent. */
  restingMultiplier: 0.5,
  /** Each farm level adds this % to everyone's night power (walls, light, people). */
  farmDefensePctPerLevel: 10,
} as const;

/** The campfire is the farm's life bar (design §15.3). */
export const FIRE = {
  /** Max fire HP per active member on a level-1 farm. */
  hpPerMember: 30,
  /** Each farm level adds this % to the max fire HP. */
  hpPctPerFarmLevel: 25,
  /** % of max HP the fire gets back every day (before the night). */
  regenPctPerDay: 35,
} as const;

/** Rewards for those who played the patrol on a night the farm survived. */
export const NIGHT_REWARDS = {
  /** XP = base + perNight × night number. */
  xpBase: 30,
  xpPerNight: 12,
} as const;

// ============================================================================
// Coins and the farm shop "Vendinha" (design §16): sell what you make, buy any
// material at a much worse price than trading with a friend.
// ============================================================================

export const MARKET = {
  /** You sell at this % of the resource's point value (1 coin = 1 point). */
  sellPct: 50,
  /** You buy at this % of the point value. */
  buyPct: 200,
  /** Daily purchase limit per player, in points of value bought: base + perLevel × level. */
  dailyBuyBase: 150,
  dailyBuyPerLevel: 15,
} as const;

// ============================================================================
// Daily tasks (design §17): three small goals a day, for coins and XP.
// ============================================================================

export const DAILY_TASKS = {
  perDay: 3,
  /** Reward of each task: base + perLevel × character level. */
  coinsBase: 30,
  coinsPerLevel: 5,
  xpBase: 20,
  xpPerLevel: 4,
  /** Extra coins for finishing all of the day's tasks. */
  bonusCoinsBase: 60,
  bonusCoinsPerLevel: 10,
  /** Targets. Collect = this many hours of the profession's base production (+10% per level). */
  collectHours: 3,
  craftBase: 5,
  craftPerLevel: 1,
  craftMax: 30,
  donateBase: 40,
  donatePerLevel: 10,
  sellBase: 30,
  sellPerLevel: 5,
} as const;

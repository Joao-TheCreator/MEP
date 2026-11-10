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

export const MAX_FARM_LEVEL = BUILDINGS.length + 1;

/** Ranking weeks start Monday 00:00 in this timezone. */
export const RANKING_TIMEZONE = "America/Sao_Paulo";

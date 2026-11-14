"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AVATAR_KEYS } from "@/art/avatars";
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  PLAYABLE_NIGHT_CLASSES,
  PROFESSION_KEYS,
  PROFESSIONS,
  RECIPE_KEYS,
  RESOURCE_KEYS,
  RESOURCES,
  SLOTS,
  SLOT_KEYS,
  TIERS,
  type AttributeKey,
  type NightClassKey,
  NOTIFY_KINDS,
  type SlotKey,
} from "@/game/config";
import { currentUser, destroySession, loginWithPassword, signupWithPassword } from "@/server/auth";
import { passwordProblem, usernameProblem } from "@/server/password";
import { validSpecialTicks, type HeroClass } from "@/game/patrol";
import * as game from "@/server/game";
import * as notices from "@/server/notices";

export type ActionResult = { ok: boolean; message: string };

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Runs a game action and turns GameErrors into friendly messages. */
async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof game.GameError) return { ok: false, message: e.message };
    if (e instanceof z.ZodError) return { ok: false, message: "Dados inválidos." };
    console.error(e);
    return { ok: false, message: "Algo deu errado. Tente de novo." };
  }
}

const qty = z.coerce.number().int().min(1).max(1_000_000);

// ---------------- auth ----------------

const passwordField = z.string().max(200);
const usernameField = z.string().max(60);

export async function login(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const username = usernameField.safeParse(form.get("username"));
  const password = passwordField.safeParse(form.get("password"));
  if (!username.success || !username.data.trim()) return { ok: false, message: "Digite seu nome." };
  if (!password.success || !password.data) return { ok: false, message: "Digite sua senha." };
  const outcome = await loginWithPassword(username.data, password.data);
  if (outcome === "throttled") return { ok: false, message: "Muitas tentativas. Espere alguns minutos e tente de novo." };
  if (outcome === "wrong") return { ok: false, message: "Nome ou senha incorretos." };
  redirect("/");
}

export async function signup(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const username = usernameField.safeParse(form.get("username"));
  const password = passwordField.safeParse(form.get("password"));
  const confirm = form.get("confirm");
  if (!username.success) return { ok: false, message: "Escolha um nome." };
  const nameProblem = usernameProblem(username.data);
  if (nameProblem) return { ok: false, message: nameProblem };
  if (!password.success) return { ok: false, message: "Digite uma senha." };
  const problem = passwordProblem(password.data, username.data);
  if (problem) return { ok: false, message: problem };
  if (confirm !== password.data) return { ok: false, message: "As duas senhas estão diferentes." };
  const outcome = await signupWithPassword(username.data, password.data);
  if (outcome === "throttled") return { ok: false, message: "Muitas tentativas. Espere alguns minutos e tente de novo." };
  if (outcome === "taken") return { ok: false, message: "Esse nome já está em uso. Escolha outro." };
  redirect("/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------------- onboarding ----------------

const onboarding = z.object({
  mode: z.enum(["create", "join"]),
  displayName: z.string().trim().min(2).max(24),
  profession: z.enum(PROFESSION_KEYS as [string, ...string[]]),
  avatar: z.enum(AVATAR_KEYS as [string, ...string[]]),
  farmName: z.string().trim().max(40).optional(),
  code: z.string().trim().max(12).optional(),
});

export async function startPlaying(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = onboarding.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Escolha seu boneco, um nome (2 a 24 letras) e uma profissão." };
  const d = parsed.data;
  const p = {
    displayName: d.displayName,
    avatar: d.avatar,
    profession: d.profession as (typeof PROFESSION_KEYS)[number],
  };
  const res = await run(async () => {
    if (d.mode === "create") {
      await game.createFarm(user.id, d.farmName || "Sítio Dae Han", p);
    } else {
      if (!d.code) throw new game.GameError("Digite o código de convite.");
      await game.joinFarm(user.id, d.code, p);
    }
    return "Bem-vindo ao sítio!";
  });
  if (res.ok) redirect("/");
  return res;
}

// ---------------- game ----------------

export async function collectAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.collect(user.id);
    if (r.units === 0) return "Ainda não há nada para coletar.";
    return `Você coletou ${r.units}!${r.capped ? " (O armazém estava cheio.)" : ""}`;
  });
}

export async function craftAction(recipe: string, times: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const key = z.enum(RECIPE_KEYS as [string, ...string[]]).parse(recipe) as (typeof RECIPE_KEYS)[number];
    const n = qty.parse(times);
    await game.craft(user.id, key, n);
    return `Feito: ${n}× ${RESOURCES[key].name}.`;
  });
}

export async function upgradeAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.upgradeWorkshop(user.id);
    return `Oficina melhorada para o nível ${r.level}!`;
  });
}

const resourceKey = z.enum(RESOURCE_KEYS as [string, ...string[]]);

export async function donateAction(resource: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const key = resourceKey.parse(resource) as (typeof RESOURCE_KEYS)[number];
    const r = await game.donate(user.id, key, qty.parse(amount));
    let msg = `Doou ${r.amount} ${RESOURCES[key].name} (+${r.points} pts).`;
    if (r.completed) msg += ` 🎉 ${r.completed} concluído! O sítio subiu de nível!`;
    return msg;
  });
}

const professionKey = z.enum(PROFESSION_KEYS as [string, ...string[]]);

export async function changeProfessionAction(profession: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const key = professionKey.parse(profession) as (typeof PROFESSION_KEYS)[number];
    const r = await game.changeProfession(user.id, key);
    return `Agora você é ${PROFESSIONS[r.profession].name}! Oficina no nível ${r.workshopLevel}.`;
  });
}

/** For the join screen: who already does what on the farm with this invite code. */
export async function professionCountsAction(code: string) {
  await requireUser();
  const parsed = z.string().trim().min(4).max(12).safeParse(code);
  if (!parsed.success) return null;
  return game.professionCountsByInvite(parsed.data);
}

export async function sendAction(toPlayerId: string, resource: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const to = z.string().uuid().parse(toPlayerId);
    const key = resourceKey.parse(resource) as (typeof RESOURCE_KEYS)[number];
    const n = qty.parse(amount);
    await game.transfer(user.id, to, key, n);
    return `Enviado: ${n} ${RESOURCES[key].name}.`;
  });
}

// ---------------- night & character (design §11, §12, §15) ----------------

const slotKey = z.enum(SLOT_KEYS as [string, ...string[]]);
const attributeKey = z.enum(ATTRIBUTE_KEYS as [string, ...string[]]);
const nightClass = z.enum(PLAYABLE_NIGHT_CLASSES);

export type StartPatrolResult = ActionResult & { run?: { runId: string; seed: number; cls: HeroClass; kind: string } };

/** Starts a patrol (spends energy) and returns the seed the mini-game must use. */
export async function startPatrolAction(): Promise<StartPatrolResult> {
  const user = await requireUser();
  try {
    const run = await game.startPatrol(user.id);
    revalidatePath("/");
    return { ok: true, message: run.kind === "patrol" ? "Boa ronda!" : "Boa expedição!", run };
  } catch (e) {
    if (e instanceof game.GameError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Algo deu errado. Tente de novo." };
  }
}

/** Ends a patrol: the server replays it and pays the rewards. */
export async function finishPatrolAction(runId: string, specialTicks: number[]): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const id = z.string().uuid().parse(runId);
    if (!validSpecialTicks(specialTicks)) throw new game.GameError("Ronda inválida.");
    const r = await game.finishPatrol(user.id, id, specialTicks);
    const loot = (Object.entries(r.loot) as [(typeof RESOURCE_KEYS)[number], number][])
      .map(([k, n]) => `${n} ${RESOURCES[k].name}`)
      .join(", ");
    const stars = r.stars === 1 ? "1 estrela" : `${r.stars} estrelas`;
    const gain = `+${r.coins} moedas${loot ? ` e ${loot}` : ""}`;
    const found = r.found.length
      ? ` Achou: ${r.found.map((it) => `${TIERS[it.tier].name} ${SLOTS[it.slot].itemName ?? SLOTS[it.slot].label}${it.refine ? ` +${it.refine}` : ""}`).join(", ")} (na mochila).`
      : Object.keys(r.dismantledOnFind).length ? " Achou um item, mas a mochila estava cheia: virou material." : "";
    if (r.kind === "patrol") {
      return (r.counts
        ? `Ronda feita com ${stars}: ${gain}. Você defende a noite ${r.night} com força total.`
        : `Ronda feita com ${stars}: ${gain}.`) + found;
    }
    return `Expedição com ${stars}: ${gain}.${found}`;
  });
}

export async function upgradeGearAction(slot: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.upgradeGear(user.id, slotKey.parse(slot) as SlotKey);
    return `${SLOTS[slot as SlotKey].label} agora é ${r.tier}!`;
  });
}

export async function refineGearAction(slot: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.refineGear(user.id, slotKey.parse(slot) as SlotKey);
    return `${SLOTS[slot as SlotKey].label} refinado para +${r.refine}.`;
  });
}

export async function attributeAction(key: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const k = attributeKey.parse(key) as AttributeKey;
    await game.addAttributePoint(user.id, k);
    return `+1 em ${ATTRIBUTES[k].name}.`;
  });
}

export async function talentAction(tier: number, option: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const t = z.number().int().min(0).max(3).parse(tier);
    const o = z.union([z.literal(0), z.literal(1)]).parse(option);
    const name = await game.pickTalent(user.id, t, o);
    return `Talento escolhido: ${name}.`;
  });
}

export async function nightClassAction(cls: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const name = await game.setNightClass(user.id, nightClass.parse(cls) as NightClassKey);
    return `Agora você é ${name} à noite.`;
  });
}

/** Development only: makes tonight's attack happen now. */
export async function devNightAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.devForceNight(user.id);
    if (!r) return "Nenhuma noite para resolver.";
    return r.wiped
      ? `A fogueira apagou na noite ${r.night}. Nova temporada!`
      : `Noite ${r.night}: horda ${r.horde} × defesa ${r.defense}. Fogueira: ${r.fireHp}.`;
  });
}

// ---------------- Vendinha (design §16) ----------------

export async function sellAction(resource: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = z.enum(RESOURCE_KEYS as [string, ...string[]]).parse(resource) as (typeof RESOURCE_KEYS)[number];
    const n = qty.parse(amount);
    const out = await game.sellToMarket(user.id, r, n);
    return `Vendeu ${n} de ${RESOURCES[r].name} por ${out.coins} moedas.`;
  });
}

export async function buyAction(resource: string, amount: number): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = z.enum(RESOURCE_KEYS as [string, ...string[]]).parse(resource) as (typeof RESOURCE_KEYS)[number];
    const n = qty.parse(amount);
    const out = await game.buyFromMarket(user.id, r, n);
    return `Comprou ${n} de ${RESOURCES[r].name} por ${out.cost} moedas.`;
  });
}

/** Donates everything useful for the current building at once. */
export async function donateAllAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.donateAll(user.id);
    return r.completed
      ? `${r.completed} concluído! O sítio subiu de nível.`
      : `Doou tudo o que a obra precisava: +${r.points} pontos.`;
  });
}

// ---------------- daily tasks (design §17) ----------------

export async function claimTasksAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.claimDailyTasks(user.id);
    return r.bonus
      ? `Todas as tarefas de hoje feitas! +${r.coins} moedas e +${r.xp} XP.`
      : `Tarefa concluída: +${r.coins} moedas e +${r.xp} XP.`;
  });
}

// ---------------- backpack (design §21) ----------------

export async function equipItemAction(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.equipFromBag(user.id, z.string().min(1).max(80).parse(itemId));
    return `Equipou ${r.tier} em ${SLOTS[r.slot].label}. O item antigo foi para a mochila.`;
  });
}

export async function equipBestAction(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const r = await game.equipBestFromBag(user.id);
    return r.changed === 1 ? "Equipou 1 item melhor da mochila." : `Equipou ${r.changed} itens melhores da mochila.`;
  });
}

export async function dismantleItemAction(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const back = await game.dismantleItem(user.id, z.string().min(1).max(80).parse(itemId));
    const list = (Object.entries(back) as [(typeof RESOURCE_KEYS)[number], number][]).map(([k, n]) => `${n} ${RESOURCES[k].name}`).join(", ");
    return list ? `Desmontou o item: ${list}.` : "Desmontou o item.";
  });
}

// ---------------- phone notices (design §23) ----------------

const PushSub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function requirePlayer() {
  const user = await requireUser();
  const player = await game.getPlayer(user.id);
  if (!player) redirect("/onboarding");
  return player;
}

export async function subscribePushAction(sub: unknown): Promise<ActionResult> {
  const player = await requirePlayer();
  return run(async () => {
    await notices.saveSubscription(player.id, PushSub.parse(sub));
    return "Avisos ligados neste aparelho.";
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult> {
  const player = await requirePlayer();
  return run(async () => {
    await notices.removeSubscription(player.id, z.string().max(1000).parse(endpoint));
    return "Avisos desligados neste aparelho.";
  });
}

export async function notifyPrefAction(kind: string, on: boolean): Promise<ActionResult> {
  const player = await requirePlayer();
  return run(async () => {
    await notices.setNotifyPref(player.id, z.enum(NOTIFY_KINDS as [string, ...string[]]).parse(kind) as (typeof NOTIFY_KINDS)[number], z.boolean().parse(on));
    return on ? "Aviso ligado." : "Aviso desligado.";
  });
}

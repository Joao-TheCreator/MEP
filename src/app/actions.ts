"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AVATAR_KEYS } from "@/art/avatars";
import { PROFESSION_KEYS, PROFESSIONS, RECIPE_KEYS, RESOURCE_KEYS, RESOURCES } from "@/game/config";
import { currentUser, destroySession, loginWithPassword, signupWithPassword } from "@/server/auth";
import { passwordProblem, usernameProblem } from "@/server/password";
import * as game from "@/server/game";

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

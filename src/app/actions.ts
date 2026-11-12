"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { AVATAR_KEYS } from "@/art/avatars";
import { PROFESSION_KEYS, PROFESSIONS, RECIPE_KEYS, RESOURCE_KEYS, RESOURCES } from "@/game/config";
import { consumeLoginToken, createLoginToken, currentUser, destroySession, normalizeEmail } from "@/server/auth";
import { sendMagicLink } from "@/server/email";
import * as game from "@/server/game";

export type ActionResult = { ok: boolean; message: string; devLink?: string };

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

export async function requestLogin(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = z.string().email().max(200).safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, message: "Digite um e-mail válido." };
  const email = normalizeEmail(parsed.data);
  const token = await createLoginToken(email);
  if (!token) return { ok: false, message: "Muitos pedidos. Espere alguns minutos e tente de novo." };

  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${base}/auth/verify?token=${token}`;
  try {
    await sendMagicLink(email, link);
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Não conseguimos enviar o e-mail agora." };
  }
  const devLink = !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production" ? link : undefined;
  return { ok: true, message: "Pronto! Confira seu e-mail e toque no link para entrar.", devLink };
}

export async function verifyLogin(form: FormData) {
  const token = z.string().min(20).max(100).safeParse(form.get("token"));
  if (!token.success || !(await consumeLoginToken(token.data))) redirect("/auth/verify?error=1");
  redirect("/");
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

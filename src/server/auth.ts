import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { authSecret, passwordLookup } from "./password";

/**
 * Login by personal password: each person types only their own password,
 * which identifies them (stored as a keyed HMAC, unique). Guessing is
 * throttled per IP.
 */

export const SESSION_COOKIE = "sitio_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW = "15 minutes";
const MAX_ATTEMPTS_PER_WINDOW = 10;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Records an attempt for this IP. Returns false when it is over the limit. */
async function allowAttempt(): Promise<boolean> {
  const ip = await clientIp();
  const sql = db();
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM login_attempts
    WHERE ip = ${ip} AND created_at > now() - ${ATTEMPT_WINDOW}::interval`;
  if (count >= MAX_ATTEMPTS_PER_WINDOW) return false;
  await sql`INSERT INTO login_attempts (ip) VALUES (${ip})`;
  // keep the table small
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`;
  return true;
}

async function startSession(userId: string) {
  const sessionToken = newToken();
  await db()`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hash(sessionToken)}, ${userId}, ${new Date(Date.now() + SESSION_TTL_MS)})`;
  (await cookies()).set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export type LoginOutcome = "ok" | "wrong" | "throttled";

/** Logs in whoever owns this password. */
export async function loginWithPassword(password: string): Promise<LoginOutcome> {
  if (!(await allowAttempt())) return "throttled";
  const rows = await db()<{ id: string }[]>`
    SELECT id FROM users WHERE password_lookup = ${passwordLookup(authSecret(), password)}`;
  if (rows.length === 0) return "wrong";
  await startSession(rows[0].id);
  return "ok";
}

export type SignupOutcome = "ok" | "taken" | "throttled";

/** Creates a new person with this password and logs them in. */
export async function signupWithPassword(password: string): Promise<SignupOutcome> {
  if (!(await allowAttempt())) return "throttled";
  const rows = await db()<{ id: string }[]>`
    INSERT INTO users (password_lookup) VALUES (${passwordLookup(authSecret(), password)})
    ON CONFLICT (password_lookup) DO NOTHING
    RETURNING id`;
  if (rows.length === 0) return "taken";
  await startSession(rows[0].id);
  return "ok";
}

export interface SessionUser {
  id: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db()<SessionUser[]>`
    SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash(token)} AND s.expires_at > now()`;
  return rows[0] ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`DELETE FROM sessions WHERE token_hash = ${hash(token)}`;
  jar.delete(SESSION_COOKIE);
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { DUMMY_HASH, hashPassword, normalizeUsername, verifyPassword } from "./password";

/**
 * Login by name + password (design §9). The password is stored with scrypt and a
 * salt. Guessing is throttled per IP and per name.
 */

export const SESSION_COOKIE = "sitio_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW = "15 minutes";
const MAX_ATTEMPTS_PER_WINDOW = 10;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel x-real-ip is set by the platform; the first x-forwarded-for entry may come from the client.
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Records an attempt for this IP and name. Returns false when either is over the limit. */
async function allowAttempt(username: string): Promise<boolean> {
  const ip = await clientIp();
  const sql = db();
  const [{ byIp, byName }] = await sql<{ byIp: number; byName: number }[]>`
    SELECT count(*) FILTER (WHERE ip = ${ip})::int AS "byIp",
           count(*) FILTER (WHERE username = ${username})::int AS "byName"
    FROM login_attempts
    WHERE created_at > now() - ${ATTEMPT_WINDOW}::interval AND (ip = ${ip} OR username = ${username})`;
  if (byIp >= MAX_ATTEMPTS_PER_WINDOW || byName >= MAX_ATTEMPTS_PER_WINDOW) return false;
  await sql`INSERT INTO login_attempts (ip, username) VALUES (${ip}, ${username})`;
  // keep the table small
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`;
  return true;
}

async function startSession(userId: string) {
  const sessionToken = newToken();
  // Housekeeping (from PR #18): drop expired sessions (of anyone) on each login.
  await db()`DELETE FROM sessions WHERE expires_at < now()`;
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

/** Logs in with name + password. A wrong name and a wrong password look the same. */
export async function loginWithPassword(name: string, password: string): Promise<LoginOutcome> {
  const username = normalizeUsername(name);
  if (!(await allowAttempt(username))) return "throttled";
  const rows = await db()<{ id: string; password_hash: string | null }[]>`
    SELECT id, password_hash FROM users WHERE username = ${username}`;
  const user = rows[0];
  // Always run scrypt, so a missing name takes as long as a wrong password.
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return "wrong";
  await startSession(user.id);
  return "ok";
}

export type SignupOutcome = "ok" | "taken" | "throttled";

/** Creates a person with this name and password and logs them in. */
export async function signupWithPassword(name: string, password: string): Promise<SignupOutcome> {
  const username = normalizeUsername(name);
  if (!(await allowAttempt(username))) return "throttled";
  const rows = await db()<{ id: string }[]>`
    INSERT INTO users (username, password_hash) VALUES (${username}, ${await hashPassword(password)})
    ON CONFLICT (username) DO NOTHING
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

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "sitio_session";
const TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TOKENS_PER_WINDOW = 3;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Creates a login token. Returns null if rate-limited. */
export async function createLoginToken(email: string): Promise<string | null> {
  const sql = db();
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM login_tokens
    WHERE email = ${email} AND created_at > now() - interval '15 minutes'`;
  if (count >= MAX_TOKENS_PER_WINDOW) return null;
  // Housekeeping: login links older than a day can't be used nor count for the rate limit.
  await sql`DELETE FROM login_tokens WHERE created_at < now() - interval '1 day'`;
  const token = newToken();
  await sql`
    INSERT INTO login_tokens (token_hash, email, expires_at)
    VALUES (${hash(token)}, ${email}, ${new Date(Date.now() + TOKEN_TTL_MS)})`;
  return token;
}

/** Consumes a login token (single use) and creates a session. Returns false if invalid. */
export async function consumeLoginToken(token: string): Promise<boolean> {
  const sql = db();
  const sessionToken = newToken();
  const ok = await sql.begin(async (tx) => {
    const rows = await tx<{ email: string }[]>`
      UPDATE login_tokens SET used_at = now()
      WHERE token_hash = ${hash(token)} AND used_at IS NULL AND expires_at > now()
      RETURNING email`;
    if (rows.length === 0) return false;
    // Housekeeping: drop expired sessions (of anyone) on each login.
    await tx`DELETE FROM sessions WHERE expires_at < now()`;
    const [user] = await tx<{ id: string }[]>`
      INSERT INTO users (email) VALUES (${rows[0].email})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id`;
    await tx`
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (${hash(sessionToken)}, ${user.id}, ${new Date(Date.now() + SESSION_TTL_MS)})`;
    return true;
  });
  if (!ok) return false;
  (await cookies()).set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export interface SessionUser {
  id: string;
  email: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db()<SessionUser[]>`
    SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash(token)} AND s.expires_at > now()`;
  return rows[0] ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`DELETE FROM sessions WHERE token_hash = ${hash(token)}`;
  jar.delete(SESSION_COOKIE);
}

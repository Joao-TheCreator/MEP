import { createHmac } from "node:crypto";

/**
 * Personal-password login: the password alone identifies the player, so it is
 * stored as a keyed HMAC that can be looked up (unique) without being
 * reversible without AUTH_SECRET. Pure helpers, no I/O (tested).
 */

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

const TOO_COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000",
  "123123", "abc123", "senha", "senha1", "senha123", "password", "qwerty", "sitio", "sitio123",
  "jesus", "jesus123", "deusefiel", "igreja", "daehan",
]);

/** Returns a message for the player when the password can't be used, or null when it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  if (TOO_COMMON.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return "Essa senha é fácil demais de adivinhar. Escolha outra.";
  }
  return null;
}

/** Deterministic, secret-keyed fingerprint of a password (what the database stores). */
export function passwordLookup(secret: string, password: string): string {
  return createHmac("sha256", secret).update(password.normalize("NFC")).digest("hex");
}

const DEV_SECRET = "dev-only-secret-change-me";

/** AUTH_SECRET from the environment; a fixed value is allowed only outside production. */
export function authSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (env.NODE_ENV === "production") throw new Error("AUTH_SECRET (16+ characters) is required in production");
  return DEV_SECRET;
}

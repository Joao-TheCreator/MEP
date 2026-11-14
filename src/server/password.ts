import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Login by name + password (design §9). The name identifies the person (it is not
 * a secret); the password is stored with scrypt and a random salt, so equal
 * passwords look different and nothing can be looked up by password.
 * Pure helpers apart from the hashing itself (tested).
 */

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const TOO_COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000",
  "123123", "abc123", "senha", "senha1", "senha123", "password", "qwerty", "sitio", "sitio123",
  "jesus", "jesus123", "deusefiel", "igreja", "daehan",
]);

/** Returns a message for the player when the password can't be used, or null when it's fine. */
export function passwordProblem(password: string, username = ""): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  const lower = password.toLowerCase();
  if (TOO_COMMON.has(lower) || /^(.)\1+$/.test(password) || (username && lower === username.toLowerCase())) {
    return "Essa senha é fácil demais de adivinhar. Escolha outra.";
  }
  return null;
}

/** Names are compared without case and without spaces around. */
export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns a message when the name can't be used, or null when it's fine. */
export function usernameProblem(name: string): string | null {
  const n = normalizeUsername(name);
  if (n.length < USERNAME_MIN || n.length > USERNAME_MAX) {
    return `O nome precisa ter de ${USERNAME_MIN} a ${USERNAME_MAX} caracteres.`;
  }
  if (!/^[a-z0-9._-]+$/.test(n)) return "Use só letras sem acento, números, ponto, traço ou _ no nome.";
  return null;
}

// scrypt cost: ~16 MB and a few tens of ms per check, fine for a small group on Vercel.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFC"), salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P, KEYLEN);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scryptAsync(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A stored hash that never matches, to spend the same time when the name doesn't exist. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

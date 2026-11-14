import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, normalizeUsername, passwordProblem, usernameProblem, verifyPassword } from "./password";

describe("password", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("fogueira42")).toBeNull();
  });

  it("rejects short, long, common and repeated passwords, and the name itself", () => {
    expect(passwordProblem("abc")).toMatch(/pelo menos 6/);
    expect(passwordProblem("x".repeat(65))).toMatch(/no máximo/);
    expect(passwordProblem("123456")).toMatch(/fácil demais/);
    expect(passwordProblem("Senha123")).toMatch(/fácil demais/);
    expect(passwordProblem("aaaaaaa")).toMatch(/fácil demais/);
    expect(passwordProblem("Rodrigo", "rodrigo")).toMatch(/fácil demais/);
  });

  it("hashes with a salt: same password, different hashes, both verify", async () => {
    const a = await hashPassword("fogueira42");
    const b = await hashPassword("fogueira42");
    expect(a).not.toBe(b);
    expect(a).not.toContain("fogueira42");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("fogueira42", a)).toBe(true);
    expect(await verifyPassword("fogueira43", a)).toBe(false);
  });

  it("treats accents typed differently as the same password", async () => {
    const h = await hashPassword("fogão123");
    expect(await verifyPassword("fogão123", h)).toBe(true);
  });

  it("the dummy hash never matches and garbage is rejected", async () => {
    expect(await verifyPassword("", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("username", () => {
  it("is compared without case and surrounding spaces", () => {
    expect(normalizeUsername("  Rodrigo ")).toBe("rodrigo");
  });

  it("accepts 3 to 20 simple characters", () => {
    expect(usernameProblem("joao-pedro")).toBeNull();
    expect(usernameProblem("Samuel.Choi")).toBeNull();
    expect(usernameProblem("ab")).toMatch(/de 3 a 20/);
    expect(usernameProblem("a".repeat(21))).toMatch(/de 3 a 20/);
    expect(usernameProblem("joão")).toMatch(/sem acento/);
    expect(usernameProblem("o joão")).toMatch(/sem acento/);
  });
});

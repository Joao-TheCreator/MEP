import { describe, expect, it } from "vitest";
import { authSecret, passwordLookup, passwordProblem } from "./password";

describe("personal password", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("fogueira42")).toBeNull();
  });

  it("rejects short, long, common and repeated passwords", () => {
    expect(passwordProblem("abc")).toMatch(/pelo menos 6/);
    expect(passwordProblem("x".repeat(65))).toMatch(/no máximo/);
    expect(passwordProblem("123456")).toMatch(/fácil demais/);
    expect(passwordProblem("Senha123")).toMatch(/fácil demais/);
    expect(passwordProblem("aaaaaaa")).toMatch(/fácil demais/);
  });

  it("lookup is deterministic, depends on the secret and is not the password", () => {
    const a = passwordLookup("secret-one-123456", "fogueira42");
    expect(a).toBe(passwordLookup("secret-one-123456", "fogueira42"));
    expect(a).not.toBe(passwordLookup("secret-two-123456", "fogueira42"));
    expect(a).not.toContain("fogueira42");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats accents typed differently as the same password", () => {
    const composed = "fogão123";
    const decomposed = "fogão123";
    expect(passwordLookup("s".repeat(16), composed)).toBe(passwordLookup("s".repeat(16), decomposed));
  });

  it("requires AUTH_SECRET in production only", () => {
    expect(() => authSecret({ NODE_ENV: "production" })).toThrow(/AUTH_SECRET/);
    expect(authSecret({ NODE_ENV: "production", AUTH_SECRET: "a-long-enough-secret" })).toBe("a-long-enough-secret");
    expect(authSecret({ NODE_ENV: "development" })).toBeTruthy();
  });
});

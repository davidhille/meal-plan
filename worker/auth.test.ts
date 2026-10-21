import { describe, expect, test } from "bun:test";
import { hashPassword, normEmail, validEmail, verifyPassword } from "./auth";

describe("Passwörter", () => {
  test("Hash ist gesalzen und lässt sich prüfen", async () => {
    const a = await hashPassword("geheim123");
    const b = await hashPassword("geheim123");
    expect(a).not.toBe(b);
    expect(a.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("geheim123", a)).toBe(true);
    expect(await verifyPassword("geheim124", a)).toBe(false);
    expect(await verifyPassword("geheim123", "kaputt")).toBe(false);
  });
});

describe("E-Mail", () => {
  test("wird vereinheitlicht und geprüft", () => {
    expect(normEmail("  David@Example.COM ")).toBe("david@example.com");
    expect(validEmail("david@example.com")).toBe(true);
    expect(validEmail("david@")).toBe(false);
  });
});

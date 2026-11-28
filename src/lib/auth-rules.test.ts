import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "@/lib/auth-rules";

describe("isValidEmail", () => {
  it.each(["ada@example.com", "  ada@example.com  ", "a.b+c@sub.example.org"])("accepts %j", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(["", "ada", "ada@example", "ada @example.com", "a@b@c.com", null, 42])("refuses %j", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

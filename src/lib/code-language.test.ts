import { describe, expect, it } from "vitest";

import { isCodeType, toMonacoLanguage } from "./code-language";

describe("isCodeType", () => {
  it("is true for snippets and commands only", () => {
    expect(isCodeType("snippet")).toBe(true);
    expect(isCodeType("command")).toBe(true);
    expect(isCodeType("note")).toBe(false);
    expect(isCodeType("prompt")).toBe(false);
    expect(isCodeType(null)).toBe(false);
  });
});

describe("toMonacoLanguage", () => {
  it("is plain text when the language is missing or blank", () => {
    expect(toMonacoLanguage(null)).toBe("plaintext");
    expect(toMonacoLanguage(undefined)).toBe("plaintext");
    expect(toMonacoLanguage("   ")).toBe("plaintext");
  });

  it("maps common short names to Monaco ids", () => {
    expect(toMonacoLanguage("ts")).toBe("typescript");
    expect(toMonacoLanguage("bash")).toBe("shell");
    expect(toMonacoLanguage("py")).toBe("python");
    expect(toMonacoLanguage("C#")).toBe("csharp");
  });

  it("trims and lowercases before matching", () => {
    expect(toMonacoLanguage("  TypeScript ")).toBe("typescript");
    expect(toMonacoLanguage(" JS")).toBe("javascript");
  });

  it("treats names of built-in object properties as plain names, never as aliases", () => {
    // `language` is free text: a lookup on a plain object would find these on its prototype.
    expect(toMonacoLanguage("constructor")).toBe("constructor");
    expect(toMonacoLanguage("__proto__")).toBe("__proto__");
  });

  it("passes unknown names through lowercased", () => {
    expect(toMonacoLanguage("Elixir")).toBe("elixir");
  });
});

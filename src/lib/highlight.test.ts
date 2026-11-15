import { describe, expect, it } from "vitest";

import { highlightCode, toShikiLanguage } from "@/lib/highlight";

describe("toShikiLanguage", () => {
  it("uses the same short names as the editor", () => {
    expect(toShikiLanguage("ts")).toBe("typescript");
    expect(toShikiLanguage("Bash")).toBe("shell");
    expect(toShikiLanguage("docker")).toBe("dockerfile");
  });

  it("maps the editor ids Shiki knows by another name", () => {
    expect(toShikiLanguage("pgsql")).toBe("sql");
    expect(toShikiLanguage("mysql")).toBe("sql");
    expect(toShikiLanguage("sol")).toBe("solidity");
  });

  it("treats names of built-in object properties as unknown", () => {
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(toShikiLanguage(name), name).toBe("text");
    }
  });

  it("falls back to plain text for an empty or unknown language", () => {
    expect(toShikiLanguage(null)).toBe("text");
    expect(toShikiLanguage("")).toBe("text");
    expect(toShikiLanguage("plaintext")).toBe("text");
    expect(toShikiLanguage("klingon")).toBe("text");
  });
});

describe("highlightCode", () => {
  it("returns one line element per line, coloured", async () => {
    const html = await highlightCode("const a = 1;\nconst b = 2;", "typescript");

    expect(html.match(/class="line"/g)).toHaveLength(2);
    expect(html).toMatch(/style="color:#[0-9A-F]{6}"/i);
  });

  it("escapes the code, so a snippet cannot inject markup", async () => {
    const html = await highlightCode(`<script>alert("x")</script>`, "html");

    expect(html).not.toMatch(/<\/?script/);
    // Shiki splits `<` and `script` into separate coloured spans; the `<` is escaped.
    expect(html).toContain("&#x3C;");
  });

  it("highlights an unknown language as plain text instead of throwing", async () => {
    const html = await highlightCode("hello", "klingon");

    expect(html).toContain("hello");
  });

  it("leaves no background or tab stop on the block: the list styles and focuses the row", async () => {
    const html = await highlightCode("a", "text");

    expect(html).not.toMatch(/<pre[^>]*style=/);
    expect(html).not.toContain("tabindex");
  });
});

import { describe, expect, it } from "vitest";

import { MAX_PREVIEW_LINE_CHARS, PREVIEW_LINES, snippetPreview } from "@/lib/snippet-text";

describe("snippetPreview", () => {
  it("keeps a short snippet whole and counts its lines", () => {
    expect(snippetPreview("const a = 1;\nconst b = 2;")).toEqual({ code: "const a = 1;\nconst b = 2;", lineCount: 2 });
  });

  it("keeps only the first lines, and counts all of them", () => {
    const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const { code, lineCount } = snippetPreview(content);

    expect(code.split("\n")).toHaveLength(PREVIEW_LINES);
    expect(code.split("\n").at(-1)).toBe(`line ${PREVIEW_LINES}`);
    expect(lineCount).toBe(20);
  });

  it("caps an overlong line, so one minified line cannot bloat the page", () => {
    const { code } = snippetPreview("x".repeat(MAX_PREVIEW_LINE_CHARS * 10));

    expect(code).toHaveLength(MAX_PREVIEW_LINE_CHARS);
  });

  it("does not count trailing blank lines, and handles Windows line endings", () => {
    expect(snippetPreview("a\r\nb\r\n\r\n")).toEqual({ code: "a\nb", lineCount: 2 });
  });

  it("is empty for empty content", () => {
    expect(snippetPreview("")).toEqual({ code: "", lineCount: 0 });
  });
});

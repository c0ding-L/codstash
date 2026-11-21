import { describe, expect, it } from "vitest";

import { MAX_SEARCH_PREVIEW_CHARS, searchPreview } from "@/lib/search-text";

describe("searchPreview", () => {
  it("is empty for an item without content", () => {
    expect(searchPreview(null, "link")).toBe("");
    expect(searchPreview("", "snippet")).toBe("");
  });

  it("collapses a snippet's whitespace onto one line", () => {
    expect(searchPreview("function a() {\n  return 1;\n}\n", "snippet")).toBe("function a() { return 1; }");
  });

  it("drops Markdown marks from prompts and notes", () => {
    expect(searchPreview("# Title\n\n**Bold** text", "prompt")).toBe("Title Bold text");
    expect(searchPreview("- [docs](https://x.dev)", "note")).toBe("docs");
  });

  it("keeps Markdown-looking characters in code", () => {
    expect(searchPreview("# comment\n**kwargs", "snippet")).toBe("# comment **kwargs");
  });

  it("cuts long text at the cap with an ellipsis", () => {
    const preview = searchPreview("a".repeat(MAX_SEARCH_PREVIEW_CHARS + 50), "command");

    expect(preview).toBe(`${"a".repeat(MAX_SEARCH_PREVIEW_CHARS)}…`);
  });

  it("leaves text at the cap whole", () => {
    const text = "b".repeat(MAX_SEARCH_PREVIEW_CHARS);

    expect(searchPreview(text, "command")).toBe(text);
  });
});

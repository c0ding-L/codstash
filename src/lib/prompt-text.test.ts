import { describe, expect, it } from "vitest";

import { countWords, estimateTokens, MAX_EXCERPT_CHARS, promptExcerpt } from "@/lib/prompt-text";

describe("promptExcerpt", () => {
  it("returns plain text as it is", () => {
    expect(promptExcerpt("Review the diff below.")).toBe("Review the diff below.");
  });

  it("reduces Markdown to its text", () => {
    const markdown = [
      "# Code review",
      "",
      "Rank **every** finding by _severity_:",
      "- correctness first",
      "* then `security`",
      "1. then [style](https://example.com)",
      "> quoted",
    ].join("\n");

    expect(promptExcerpt(markdown)).toBe(
      "Code review Rank every finding by severity: correctness first then security then style quoted",
    );
  });

  it("keeps underscores inside words and asterisks between spaces", () => {
    expect(promptExcerpt("Rename snake_case_name to camelCase; 2 * 3 * 4 = 24")).toBe(
      "Rename snake_case_name to camelCase; 2 * 3 * 4 = 24",
    );
  });

  it("drops fenced code blocks", () => {
    expect(promptExcerpt("Fix this:\n```ts\nconst a = 1;\n```\nThanks.")).toBe("Fix this: Thanks.");
  });

  it("collapses whitespace and trims", () => {
    expect(promptExcerpt("  a\n\n\tb   c  ")).toBe("a b c");
  });

  it("cuts a long text on a word boundary and marks the cut", () => {
    const excerpt = promptExcerpt("word ".repeat(200));

    expect(excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS + 1);
    expect(excerpt.endsWith("word…")).toBe(true);
  });

  it("does not leave punctuation before the ellipsis", () => {
    // Every word ends in a full stop, so wherever the cut lands, one precedes it.
    const excerpt = promptExcerpt("Stop. ".repeat(100));

    expect(excerpt).toMatch(/Stop…$/);
    expect(excerpt).not.toMatch(/[.,;:!?]…$/);
  });

  it("cuts a single overlong word where it must", () => {
    expect(promptExcerpt("x".repeat(MAX_EXCERPT_CHARS + 50))).toBe(`${"x".repeat(MAX_EXCERPT_CHARS)}…`);
  });

  it("returns an empty string for empty content", () => {
    expect(promptExcerpt("")).toBe("");
  });
});

describe("countWords", () => {
  it("counts the words separated by any whitespace", () => {
    expect(countWords("Review the diff\nbelow,  please.")).toBe(5);
  });

  it("is zero for empty or blank content", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(" \n\t ")).toBe(0);
  });
});

describe("estimateTokens", () => {
  it("estimates about four characters per token, rounded up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("is zero for empty content", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

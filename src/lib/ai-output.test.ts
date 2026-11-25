import { describe, expect, it } from "vitest";

import {
  EXPLANATION_MAX_LENGTH,
  parseDescription,
  parseExplanation,
  parseOptimizedPrompt,
  parseTagSuggestions,
} from "@/lib/ai-output";

describe("parseTagSuggestions", () => {
  it("reads a comma-separated line", () => {
    expect(parseTagSuggestions("react, hooks, state", [])).toEqual(["react", "hooks", "state"]);
  });

  it("strips code fences, a Tags: prefix and quotes", () => {
    expect(parseTagSuggestions('```text\nTags: "react", \'hooks\', `state`\n```', [])).toEqual([
      "react",
      "hooks",
      "state",
    ]);
    expect(parseTagSuggestions('["react", "hooks"]', [])).toEqual(["react", "hooks"]);
  });

  it("reads one tag per line, with list markers or hashtags", () => {
    expect(parseTagSuggestions("- react\n- hooks\n1. state\n#css", [])).toEqual(["react", "hooks", "state", "css"]);
  });

  it("lowercases and removes duplicates after lowercasing", () => {
    expect(parseTagSuggestions("React, react, HOOKS", [])).toEqual(["react", "hooks"]);
  });

  it("drops tags longer than 50 characters", () => {
    expect(parseTagSuggestions(`react, ${"a".repeat(51)}, ${"b".repeat(50)}`, [])).toEqual(["react", "b".repeat(50)]);
  });

  it("keeps at most 5", () => {
    expect(parseTagSuggestions("a, b, c, d, e, f, g", [])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("drops the item's tags, whatever their case", () => {
    expect(parseTagSuggestions("react, hooks, css", ["React", "CSS"])).toEqual(["hooks"]);
  });

  it("keeps no more than the item has room for", () => {
    const existing = Array.from({ length: 18 }, (_, index) => `tag${index}`);
    expect(parseTagSuggestions("a, b, c", existing)).toEqual(["a", "b"]);
    expect(parseTagSuggestions("a", [...existing, "x", "y"])).toEqual([]);
  });

  it("is empty when nothing usable is left", () => {
    expect(parseTagSuggestions("", [])).toEqual([]);
    expect(parseTagSuggestions("```\n```", [])).toEqual([]);
    expect(parseTagSuggestions(", ,", [])).toEqual([]);
  });
});

describe("parseDescription", () => {
  it("keeps a plain answer as it is", () => {
    expect(parseDescription("A React hook that debounces a value. Handy for search inputs.")).toBe(
      "A React hook that debounces a value. Handy for search inputs.",
    );
  });

  it("strips a prefix, code fences, wrapping quotes and bold", () => {
    expect(parseDescription('```text\nDescription: "A **fast** grep wrapper."\n```')).toBe("A fast grep wrapper.");
    expect(parseDescription("Summary: “Lists open ports.”")).toBe("Lists open ports.");
  });

  it("keeps quotes inside the text", () => {
    expect(parseDescription('Runs "npm test" on save.')).toBe('Runs "npm test" on save.');
  });

  it("joins lines into one paragraph", () => {
    expect(parseDescription("  First line.\n\n  Second line.  ")).toBe("First line. Second line.");
  });

  it("cuts an overlong answer at a word, within the description limit", () => {
    const text = parseDescription("word ".repeat(1_000));

    expect(text.length).toBeLessThanOrEqual(2_000);
    expect(text.endsWith("word…")).toBe(true);
  });

  it("is empty when nothing usable is left", () => {
    expect(parseDescription("")).toBe("");
    expect(parseDescription("```\n```")).toBe("");
    expect(parseDescription('""')).toBe("");
  });
});

describe("parseExplanation", () => {
  it("keeps Markdown as it is, trimmed", () => {
    expect(parseExplanation("\n  It **lists** files.\n\n- `-l`: long format\n  ")).toBe(
      "It **lists** files.\n\n- `-l`: long format",
    );
  });

  it.each([
    ["```markdown\nIt lists files.\n```", "It lists files."],
    ["```md\nIt lists files.\n```", "It lists files."],
    ["```\nIt lists files.\n```", "It lists files."],
    ["````markdown\nIt lists files.\n```bash\nls -la\n```\n````", "It lists files.\n```bash\nls -la\n```"],
  ])("strips a fence wrapping the whole answer: %j", (answer, expected) => {
    expect(parseExplanation(answer)).toBe(expected);
  });

  it("keeps a code block inside a wrapping markdown fence", () => {
    expect(parseExplanation("```markdown\nRun:\n\n    ls\n\nDone.\n```")).toBe("Run:\n\n    ls\n\nDone.");
  });

  it("strips a markdown fence around an answer with fenced code blocks of the same length", () => {
    expect(parseExplanation("```markdown\nRun:\n```bash\nls\n```\nDone.\n```")).toBe("Run:\n```bash\nls\n```\nDone.");
  });

  it("keeps inner code blocks when the answer is not wrapped", () => {
    const answer = "It lists files.\n\n```bash\nls -la\n```\n\nThe `-a` flag shows hidden files.";
    expect(parseExplanation(answer)).toBe(answer);
  });

  it("does not take two code blocks for a wrapping fence", () => {
    const answer = "```\nls\n```\nlists files, while\n```\nls -a\n```";
    expect(parseExplanation(answer)).toBe(answer);
  });

  it("does not strip a fence around a single code block in another language", () => {
    const answer = "```bash\nls -la\n```";
    expect(parseExplanation(answer)).toBe(answer);
  });

  it(`caps the text at ${EXPLANATION_MAX_LENGTH} characters, never mid-word`, () => {
    const text = parseExplanation("word ".repeat(1_500));
    expect(text.length).toBeLessThanOrEqual(EXPLANATION_MAX_LENGTH);
    expect(text.endsWith("word…")).toBe(true);
  });

  it("is empty when nothing usable is left", () => {
    expect(parseExplanation("   ")).toBe("");
    expect(parseExplanation("```markdown\n\n```")).toBe("");
  });
});

describe("parseOptimizedPrompt", () => {
  const ORIGINAL = "review my code";

  it("returns the rewrite, trimmed, keeping its line breaks", () => {
    expect(parseOptimizedPrompt("\n  Review this:\n\n{{code}}  \n", ORIGINAL)).toEqual({
      changed: true,
      prompt: "Review this:\n\n{{code}}",
    });
  });

  it("reads NO_CHANGES as no change, even quoted or in code", () => {
    for (const answer of ["NO_CHANGES", " `NO_CHANGES` ", '"NO_CHANGES."', "**NO_CHANGES**"]) {
      expect(parseOptimizedPrompt(answer, ORIGINAL)).toEqual({ changed: false });
    }
  });

  it("reads the original, whitespace aside, as no change", () => {
    expect(parseOptimizedPrompt("review\n  my   code", ORIGINAL)).toEqual({ changed: false });
  });

  it("strips a lead-in line", () => {
    for (const lead of ["Here is the improved prompt:", "Here's an optimized prompt:", "Refined prompt", "Optimised prompt:"]) {
      expect(parseOptimizedPrompt(`${lead}\nReview the code.`, ORIGINAL)).toEqual({
        changed: true,
        prompt: "Review the code.",
      });
    }
  });

  it("keeps a first line that only mentions a prompt", () => {
    const answer = "Write a prompt that reviews code:\nfocus on bugs.";
    expect(parseOptimizedPrompt(answer, ORIGINAL)).toEqual({ changed: true, prompt: answer });
  });

  it("strips a fence wrapping the whole answer, with or without a language", () => {
    for (const fence of ["```", "```text", "```markdown", "````prompt"]) {
      const close = fence.match(/^`+/)![0];
      expect(parseOptimizedPrompt(`${fence}\nReview the code.\n${close}`, ORIGINAL)).toEqual({
        changed: true,
        prompt: "Review the code.",
      });
    }
  });

  it("keeps code blocks that are part of the prompt", () => {
    const answer = "```js\nconst a = 1;\n```\nExplain the code above.\n```js\nconst b = 2;\n```";
    expect(parseOptimizedPrompt(answer, ORIGINAL)).toEqual({ changed: true, prompt: answer });
  });

  it("is null when nothing is left", () => {
    expect(parseOptimizedPrompt("   ", ORIGINAL)).toBeNull();
    expect(parseOptimizedPrompt("```\n\n```", ORIGINAL)).toBeNull();
  });

  it("is null rather than cut when the rewrite is over the content limit", () => {
    expect(parseOptimizedPrompt("a".repeat(100_001), ORIGINAL)).toBeNull();
  });
});

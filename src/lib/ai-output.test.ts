import { describe, expect, it } from "vitest";

import { parseTagSuggestions } from "@/lib/ai-output";

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

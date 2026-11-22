import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_PREFERENCES,
  editorPreferencesSchema,
  parseEditorPreferences,
} from "@/lib/editor-preferences";

describe("parseEditorPreferences", () => {
  it.each([null, undefined, "text", 42, []])("falls back to the defaults for %j", (stored) => {
    expect(parseEditorPreferences(stored)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it("reads a complete, valid object", () => {
    const stored = { fontSize: 16, tabSize: 4, wordWrap: false, minimap: true, theme: "monokai" };
    expect(parseEditorPreferences(stored)).toEqual(stored);
  });

  it("fills missing keys and replaces invalid values one field at a time", () => {
    expect(parseEditorPreferences({ fontSize: 99, tabSize: 8, theme: "solarized", minimap: "yes" })).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      tabSize: 8,
    });
  });

  it("drops unknown keys", () => {
    expect(parseEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES, extra: 1 })).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});

describe("editorPreferencesSchema", () => {
  it("accepts the defaults", () => {
    expect(editorPreferencesSchema.safeParse(DEFAULT_EDITOR_PREFERENCES).success).toBe(true);
  });

  it.each([
    { fontSize: 11 },
    { fontSize: "14" },
    { tabSize: 3 },
    { wordWrap: "on" },
    { theme: "vs" },
  ])("rejects %j", (change) => {
    expect(editorPreferencesSchema.safeParse({ ...DEFAULT_EDITOR_PREFERENCES, ...change }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const partial: Partial<typeof DEFAULT_EDITOR_PREFERENCES> = { ...DEFAULT_EDITOR_PREFERENCES };
    delete partial.minimap;
    expect(editorPreferencesSchema.safeParse(partial).success).toBe(false);
  });
});

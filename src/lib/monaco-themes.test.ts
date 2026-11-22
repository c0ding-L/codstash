import { describe, expect, it } from "vitest";

import { EDITOR_THEMES } from "@/lib/editor-preferences";
import { CUSTOM_MONACO_THEMES } from "@/lib/monaco-themes";

/** Monaco's own themes; anything else offered in settings must be defined here. */
const BUILT_IN = ["vs-dark"];

describe("CUSTOM_MONACO_THEMES", () => {
  it("defines every offered theme Monaco does not ship, and nothing else", () => {
    const needed = EDITOR_THEMES.filter((theme) => !BUILT_IN.includes(theme)).sort();

    expect(Object.keys(CUSTOM_MONACO_THEMES).sort()).toEqual(needed);
  });

  it.each(Object.entries(CUSTOM_MONACO_THEMES))("%s builds on vs-dark and sets its background", (_name, theme) => {
    expect(theme.base).toBe("vs-dark");
    expect(theme.colors["editor.background"]).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

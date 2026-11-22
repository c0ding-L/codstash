import { z } from "zod";

export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20] as const;
export const TAB_SIZES = [2, 4, 8] as const;
export const EDITOR_THEMES = ["vs-dark", "monokai", "github-dark"] as const;

export type EditorTheme = (typeof EDITOR_THEMES)[number];

export const EDITOR_THEME_LABELS: Record<EditorTheme, string> = {
  "vs-dark": "VS Code Dark",
  monokai: "Monokai",
  "github-dark": "GitHub Dark",
};

export interface EditorPreferences {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  theme: EditorTheme;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  theme: "vs-dark",
};

const oneOf = <T extends number>(values: readonly T[]) =>
  z.number().refine((value): value is T => (values as readonly number[]).includes(value));

/** What the update action accepts: every field, each one of the offered values. */
export const editorPreferencesSchema = z.object({
  fontSize: oneOf(FONT_SIZES),
  tabSize: oneOf(TAB_SIZES),
  wordWrap: z.boolean(),
  minimap: z.boolean(),
  theme: z.enum(EDITOR_THEMES),
});

/**
 * Reads the stored JSON column. A null column, a missing key or a value that is
 * no longer offered falls back to its default, field by field.
 */
export function parseEditorPreferences(stored: unknown): EditorPreferences {
  const record = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const shape = editorPreferencesSchema.shape;
  const pick = <K extends keyof EditorPreferences>(key: K): EditorPreferences[K] => {
    const parsed = shape[key].safeParse(record[key]);
    return parsed.success ? (parsed.data as EditorPreferences[K]) : DEFAULT_EDITOR_PREFERENCES[key];
  };
  return {
    fontSize: pick("fontSize"),
    tabSize: pick("tabSize"),
    wordWrap: pick("wordWrap"),
    minimap: pick("minimap"),
    theme: pick("theme"),
  };
}

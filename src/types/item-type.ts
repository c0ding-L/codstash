/** System item types. The spec calls the last one "URL"; the UI labels it "Links". */
export type ItemTypeSlug =
  | "snippet"
  | "prompt"
  | "note"
  | "command"
  | "file"
  | "image"
  | "link";

/** Semantic color token per type. The UI maps these to Tailwind classes. */
export type ColorToken =
  | "emerald"
  | "amber"
  | "blue"
  | "cyan"
  | "rose"
  | "violet"
  | "yellow";

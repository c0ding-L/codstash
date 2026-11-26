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
  | "lime"
  | "orange"
  | "fuchsia"
  | "indigo"
  | "brown"
  | "white"
  | "slate";

/** A type row as the queries return it, system or custom. `resolveTypeView` turns it into what the UI shows. */
export interface TypeRef {
  slug: string;
  name: string;
  /** A key of `CUSTOM_TYPE_ICONS` for a custom type; system types use their own icon. */
  icon: string | null;
  color: string | null;
  isSystem: boolean;
}

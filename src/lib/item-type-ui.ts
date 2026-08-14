import {
  Code2,
  File,
  FileText,
  Image,
  Link as LinkIcon,
  type LucideIcon,
  Sparkles,
  SquareTerminal,
} from "lucide-react";

import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

/**
 * Mock data stores lucide icon names as strings. Mapping them explicitly keeps
 * the icons tree-shakeable and type-checked — indexing the lucide namespace at
 * runtime would give up both.
 */
export const typeIcons: Record<ItemTypeSlug, LucideIcon> = {
  snippet: Code2,
  prompt: Sparkles,
  note: FileText,
  command: SquareTerminal,
  file: File,
  image: Image,
  link: LinkIcon,
};

/** Tailwind cannot see interpolated class names, so the tokens are spelled out. */
export const colorClasses: Record<ColorToken, string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  blue: "text-blue-400",
  cyan: "text-cyan-400",
  rose: "text-rose-400",
  violet: "text-violet-400",
  yellow: "text-yellow-400",
};

/** Background wash used behind a type's icon on cards. */
export const surfaceClasses: Record<ColorToken, string> = {
  emerald: "bg-emerald-400/10",
  amber: "bg-amber-400/10",
  blue: "bg-blue-400/10",
  cyan: "bg-cyan-400/10",
  rose: "bg-rose-400/10",
  violet: "bg-violet-400/10",
  yellow: "bg-yellow-400/10",
};

/**
 * Card background tint, per `@context/features/item-type-card-color-handler.md`:
 * the largest surface gets the faintest accent, 6%. That document's
 * `bg-snippet/[0.06]` form needs `--snippet` OKLCH tokens which this project
 * does not define, so the same rule is applied to the palette colours already
 * in use here.
 */
export const washClasses: Record<ColorToken, string> = {
  emerald: "bg-emerald-400/[0.06]",
  amber: "bg-amber-400/[0.06]",
  blue: "bg-blue-400/[0.06]",
  cyan: "bg-cyan-400/[0.06]",
  rose: "bg-rose-400/[0.06]",
  violet: "bg-violet-400/[0.06]",
  yellow: "bg-yellow-400/[0.06]",
};

/**
 * Card edge on hover, 40% per the same document. `Card` draws its edge with
 * `ring-1 ring-foreground/10` rather than a border, so this overrides the ring.
 */
export const ringClasses: Record<ColorToken, string> = {
  emerald: "hover:ring-emerald-400/40",
  amber: "hover:ring-amber-400/40",
  blue: "hover:ring-blue-400/40",
  cyan: "hover:ring-cyan-400/40",
  rose: "hover:ring-rose-400/40",
  violet: "hover:ring-violet-400/40",
  yellow: "hover:ring-yellow-400/40",
};

/** Sidebar labels and href segments — the schema has no `pluralName` column. */
export const typePluralNames: Record<ItemTypeSlug, string> = {
  snippet: "Snippets",
  prompt: "Prompts",
  note: "Notes",
  command: "Commands",
  file: "Files",
  image: "Images",
  link: "Links",
};

/** Fixed sidebar order and display labels (plural, leading cap). */
export const sidebarTypes: { slug: ItemTypeSlug; label: string }[] = [
  { slug: "snippet", label: "Snippets" },
  { slug: "prompt", label: "Prompts" },
  { slug: "note", label: "Notes" },
  { slug: "file", label: "Files" },
  { slug: "image", label: "Images" },
  { slug: "link", label: "Links" },
];

/**
 * Database rows carry `slug` and `color` as plain strings. These narrow them to
 * the keys of the records above, returning null for anything unrecognised so a
 * custom type cannot crash the UI.
 */
export function toItemTypeSlug(slug: string): ItemTypeSlug | null {
  return slug in typeIcons ? (slug as ItemTypeSlug) : null;
}

export function toColorToken(color: string | null): ColorToken | null {
  return color !== null && color in colorClasses ? (color as ColorToken) : null;
}

/** Routes types to `/items/snippets`, etc. — plural and lowercased. */
export function itemTypeHref(slug: ItemTypeSlug) {
  return `/items/${typePluralNames[slug].toLowerCase()}`;
}

/** Derive avatar initials from a display name when the user has no image. */
export function initialsFromName(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

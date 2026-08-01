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

import { itemTypes, type ColorToken, type ItemType, type ItemTypeSlug } from "@/lib/mock-data";

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

/** The spec routes types to `/items/snippets`, so plural and lowercased. */
export function itemTypeHref(type: ItemType) {
  return `/items/${type.pluralName.toLowerCase()}`;
}

export function typeById(id: string) {
  return itemTypes.find((type) => type.id === id);
}

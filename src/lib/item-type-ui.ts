import {
  BookOpen,
  Box,
  Brain,
  Bug,
  Cloud,
  Code2,
  Cpu,
  Database,
  File,
  FileText,
  Flag,
  FlaskConical,
  GitBranch,
  Globe,
  Heart,
  Image,
  KeyRound,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  Lock,
  type LucideIcon,
  Package,
  Palette,
  Rocket,
  Server,
  Sparkles,
  SquareTerminal,
  Star,
  Wrench,
  Zap,
} from "lucide-react";

import type { ColorToken, ItemTypeSlug, TypeRef } from "@/types/item-type";

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

/**
 * The system types' colours, as seeded. For places that render before any type
 * row is loaded, like the create dialog in the top bar. Elsewhere the row's
 * own `color` is used.
 */
export const typeColors: Record<ItemTypeSlug, ColorToken> = {
  snippet: "emerald",
  prompt: "amber",
  note: "blue",
  command: "cyan",
  file: "rose",
  image: "violet",
  link: "lime",
};

/**
 * Tailwind cannot see interpolated class names, so the tokens are spelled out. Brown has no
 * Tailwind palette, hence its arbitrary value; it is kept light enough for the dark theme.
 */
export const colorClasses: Record<ColorToken, string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  blue: "text-blue-400",
  cyan: "text-cyan-400",
  rose: "text-rose-400",
  violet: "text-violet-400",
  lime: "text-lime-400",
  orange: "text-orange-400",
  fuchsia: "text-fuchsia-400",
  indigo: "text-indigo-400",
  brown: "text-[#b9805a]",
  white: "text-stone-200",
  slate: "text-slate-400",
};

/** Background wash used behind a type's icon on cards. */
export const surfaceClasses: Record<ColorToken, string> = {
  emerald: "bg-emerald-400/10",
  amber: "bg-amber-400/10",
  blue: "bg-blue-400/10",
  cyan: "bg-cyan-400/10",
  rose: "bg-rose-400/10",
  violet: "bg-violet-400/10",
  lime: "bg-lime-400/10",
  orange: "bg-orange-400/10",
  fuchsia: "bg-fuchsia-400/10",
  indigo: "bg-indigo-400/10",
  brown: "bg-[#b9805a]/10",
  white: "bg-stone-200/10",
  slate: "bg-slate-400/10",
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
  lime: "bg-lime-400/[0.06]",
  orange: "bg-orange-400/[0.06]",
  fuchsia: "bg-fuchsia-400/[0.06]",
  indigo: "bg-indigo-400/[0.06]",
  brown: "bg-[#b9805a]/[0.06]",
  white: "bg-stone-200/[0.06]",
  slate: "bg-slate-400/[0.06]",
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
  lime: "hover:ring-lime-400/40",
  orange: "hover:ring-orange-400/40",
  fuchsia: "hover:ring-fuchsia-400/40",
  indigo: "hover:ring-indigo-400/40",
  brown: "hover:ring-[#b9805a]/40",
  white: "hover:ring-stone-200/40",
  slate: "hover:ring-slate-400/40",
};

/** English plurals: the `/items/<segment>` URLs, and labels not yet translated. */
export const typePluralNames: Record<ItemTypeSlug, string> = {
  snippet: "Snippets",
  prompt: "Prompts",
  note: "Notes",
  command: "Commands",
  file: "Files",
  image: "Images",
  link: "Links",
};

/** Item types gated behind the Pro plan — surfaced with a "PRO" badge. */
export const proTypeSlugs: ReadonlySet<ItemTypeSlug> = new Set(["file", "image"]);

/** Fixed sidebar order. The labels come from the `itemTypes` messages, in the UI language. */
export const sidebarTypes: { slug: ItemTypeSlug }[] = [
  { slug: "snippet" },
  { slug: "prompt" },
  { slug: "note" },
  { slug: "command" },
  { slug: "file" },
  { slug: "image" },
  { slug: "link" },
];

const CONTENT_FIELD_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["snippet", "prompt", "command", "note"]);
const LANGUAGE_FIELD_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["snippet", "command"]);

/** Whether the item forms show a Content field for this type. */
export function hasContentField(slug: ItemTypeSlug | null) {
  return slug !== null && CONTENT_FIELD_TYPES.has(slug);
}

/** Whether the item forms show a Language field for this type. */
export function hasLanguageField(slug: ItemTypeSlug | null) {
  return slug !== null && LANGUAGE_FIELD_TYPES.has(slug);
}

/** Whether the item forms show a URL field for this type. */
export function hasUrlField(slug: ItemTypeSlug | null) {
  return slug === "link";
}

/**
 * Database rows carry `slug` and `color` as plain strings. These narrow them to
 * the keys of the records above, returning null for anything unrecognised so a
 * custom type cannot crash the UI.
 */
export function toItemTypeSlug(slug: string): ItemTypeSlug | null {
  return Object.hasOwn(typeIcons, slug) ? (slug as ItemTypeSlug) : null;
}

export function toColorToken(color: string | null): ColorToken | null {
  return color !== null && Object.hasOwn(colorClasses, color) ? (color as ColorToken) : null;
}

/** Routes types to `/items/snippets`, etc. — plural and lowercased. */
export function itemTypeHref(slug: ItemTypeSlug) {
  return `/items/${typePluralNames[slug].toLowerCase()}`;
}

/** The reverse of `itemTypeHref`: null for a URL segment that names no type. */
export function itemTypeFromSegment(segment: string): ItemTypeSlug | null {
  const slugs = Object.keys(typePluralNames) as ItemTypeSlug[];
  return slugs.find((slug) => typePluralNames[slug].toLowerCase() === segment) ?? null;
}

/** The `/items/<segment>` of a pathname, decoded: a system plural or a custom slug. Null on any other page. */
export function typeSegmentFromPathname(pathname: string): string | null {
  const segment = /^\/items\/([^/]+)/.exec(pathname)?.[1];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** The type a page lists, from its pathname: `/items/prompts` gives "prompt". Null on any other page. */
export function itemTypeFromPathname(pathname: string): ItemTypeSlug | null {
  const segment = typeSegmentFromPathname(pathname);
  return segment ? itemTypeFromSegment(segment) : null;
}

/**
 * The icons a custom type can pick, by the key stored in `ItemType.icon`. Spelled out, like
 * `typeIcons`, so the icons stay tree-shakeable. A key not listed here renders as `Box`.
 */
export const CUSTOM_TYPE_ICONS = {
  box: Box,
  bug: Bug,
  wrench: Wrench,
  "book-open": BookOpen,
  database: Database,
  server: Server,
  cloud: Cloud,
  lock: Lock,
  key: KeyRound,
  rocket: Rocket,
  lightbulb: Lightbulb,
  brain: Brain,
  cpu: Cpu,
  "git-branch": GitBranch,
  globe: Globe,
  package: Package,
  layers: Layers,
  "list-checks": ListChecks,
  flask: FlaskConical,
  palette: Palette,
  flag: Flag,
  star: Star,
  heart: Heart,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>;

export type CustomIconKey = keyof typeof CUSTOM_TYPE_ICONS;

export const DEFAULT_CUSTOM_ICON: CustomIconKey = "box";
export const DEFAULT_CUSTOM_COLOR: ColorToken = "indigo";

/**
 * The colours a custom type can pick: only those no system type uses, so a custom type never
 * looks like a built-in one. In the order the type dialog offers them.
 */
export const CUSTOM_COLOR_TOKENS = ["orange", "brown", "fuchsia", "indigo", "white", "slate"] as const satisfies readonly ColorToken[];

/** How the UI shows a type, the same way for system and custom ones. */
export interface TypeView {
  slug: string;
  /** The system type's slug; null for a custom type. Picks the fields and the list layout. */
  systemSlug: ItemTypeSlug | null;
  label: string;
  Icon: LucideIcon;
  color: ColorToken;
  href: string;
  isSystem: boolean;
}

/**
 * The one view of a type. A system type keeps its own icon and the label `translate` gives
 * (the `itemTypes` messages); a custom type shows its name as typed, never translated. An
 * unknown icon or colour falls back to `Box` and indigo.
 */
export function resolveTypeView(type: TypeRef, translate: (slug: ItemTypeSlug) => string): TypeView {
  const systemSlug = type.isSystem ? toItemTypeSlug(type.slug) : null;
  if (systemSlug) {
    return {
      slug: systemSlug,
      systemSlug,
      label: translate(systemSlug),
      Icon: typeIcons[systemSlug],
      color: toColorToken(type.color) ?? typeColors[systemSlug],
      href: itemTypeHref(systemSlug),
      isSystem: true,
    };
  }
  return {
    slug: type.slug,
    systemSlug: null,
    label: type.name,
    Icon: customTypeIcon(type.icon),
    color: toColorToken(type.color) ?? DEFAULT_CUSTOM_COLOR,
    href: `/items/${type.slug}`,
    isSystem: false,
  };
}

/**
 * The system type whose fields and drawer body an item of this type uses. A custom type is a
 * text type: a note's Markdown content (its forms add a Language field).
 */
export function fieldsSlugOf(view: Pick<TypeView, "systemSlug">): ItemTypeSlug {
  return view.systemSlug ?? "note";
}

export function customTypeIcon(icon: string | null): LucideIcon {
  return icon !== null && Object.hasOwn(CUSTOM_TYPE_ICONS, icon) ? CUSTOM_TYPE_ICONS[icon as CustomIconKey] : Box;
}

/**
 * The slug a custom type's name gives: lowercase ASCII (accents stripped), `[a-z0-9-]` with
 * single dashes, at most 40 characters. Null when fewer than 2 characters are left.
 */
export function slugify(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug.length >= 2 ? slug : null;
}

/** Slugs a custom type cannot take: the system slugs and plurals, and the words routes keep. */
const RESERVED_TYPE_SLUGS: ReadonlySet<string> = new Set([
  ...Object.keys(typePluralNames),
  ...Object.values(typePluralNames).map((plural) => plural.toLowerCase()),
  "new",
  "custom",
  "all",
]);

export function isReservedTypeSlug(slug: string) {
  return RESERVED_TYPE_SLUGS.has(slug);
}

/** Derive avatar initials from a display name when the user has no image. */
export function initialsFromName(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

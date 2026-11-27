import { ArrowLeftRight, Braces, Search, Shapes, type LucideIcon } from "lucide-react";
import type { Messages } from "next-intl";

import type { ItemTypeSlug } from "@/types/item-type";

/** A key of `home.preview.text`: our sample content, worded per language. */
export type PreviewTextKey = keyof Messages["home"]["preview"]["text"];

/**
 * Text on a preview card. The samples are ours, so prose is translated by key; code, commands,
 * file and product names are not language and stay as written; a file size is formatted for the
 * locale.
 */
export type PreviewText = { key: PreviewTextKey } | { literal: string } | { bytes: number };

/** Cards in the hero's dashboard preview. `id` keys the list, the same in every language. */
export const previewItems: { id: string; type: ItemTypeSlug; title: PreviewText; meta: PreviewText; favorite?: boolean }[] = [
  { id: "debounce", type: "snippet", title: { key: "useDebounce" }, meta: { literal: "React · TypeScript" }, favorite: true },
  { id: "review", type: "prompt", title: { key: "codeReview" }, meta: { literal: "Claude · GPT" } },
  { id: "rebase", type: "command", title: { literal: "git rebase -i HEAD~3" }, meta: { literal: "Git" } },
  { id: "postgres", type: "note", title: { key: "postgresIndexing" }, meta: { key: "database" } },
  { id: "tailwind", type: "link", title: { key: "tailwindDocs" }, meta: { literal: "tailwindcss.com" } },
  { id: "compose", type: "file", title: { literal: "docker-compose.yml" }, meta: { bytes: 2150 } },
];

/** The sidebar of the preview; labels are the item types' own plural names. */
export const previewTypes: ItemTypeSlug[] = ["snippet", "prompt", "note", "command", "file", "image", "link"];

export const previewCollections: PreviewTextKey[] = ["reactPatterns", "devops", "aiWorkflows"];

/**
 * Feature cards, worded in `home.features.cards`. `type` picks an item type's icon and accent;
 * a card with `icon` instead is neutral.
 */
export const features: ({ key: keyof Messages["home"]["features"]["cards"] } & ({ type: ItemTypeSlug } | { icon: LucideIcon }))[] = [
  { type: "snippet", key: "snippets" },
  { type: "prompt", key: "prompts" },
  { type: "command", key: "commands" },
  { type: "note", key: "notes" },
  { type: "file", key: "files" },
  { icon: Search, key: "search" },
  { icon: Braces, key: "variables" },
  { icon: Shapes, key: "customTypes" },
  { icon: ArrowLeftRight, key: "importExport" },
];

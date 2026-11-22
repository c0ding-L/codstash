import type { ItemTypeSlug } from "@/types/item-type";

/** Cards in the hero's dashboard preview. */
export const previewItems: { type: ItemTypeSlug; title: string; meta: string; favorite?: boolean }[] = [
  { type: "snippet", title: "useDebounce hook", meta: "React · TypeScript", favorite: true },
  { type: "prompt", title: "Code review prompt", meta: "Claude · GPT" },
  { type: "command", title: "git rebase -i HEAD~3", meta: "Git" },
  { type: "note", title: "Postgres indexing", meta: "Database" },
  { type: "link", title: "Tailwind docs", meta: "tailwindcss.com" },
  { type: "file", title: "docker-compose.yml", meta: "2.1 KB" },
];

export const previewTypes: { type: ItemTypeSlug; label: string }[] = [
  { type: "snippet", label: "Snippets" },
  { type: "prompt", label: "Prompts" },
  { type: "note", label: "Notes" },
  { type: "command", label: "Commands" },
  { type: "file", label: "Files" },
  { type: "image", label: "Images" },
  { type: "link", label: "Links" },
];

export const previewCollections = ["React Patterns", "DevOps", "AI Workflows"];

/** Feature cards. `type` picks the accent; `null` is the neutral card. */
export const features: { type: ItemTypeSlug | null; title: string; description: string }[] = [
  {
    type: "snippet",
    title: "Code Snippets",
    description: "Save reusable code with syntax highlighting, language tags and one-click copy.",
  },
  {
    type: "prompt",
    title: "AI Prompts",
    description: "Keep your best prompts versioned and ready for any model.",
  },
  {
    type: "command",
    title: "Commands",
    description: "Never dig through bash history again. Store the commands you always forget.",
  },
  {
    type: "note",
    title: "Notes & Links",
    description: "Markdown notes and bookmarks living right next to your code.",
  },
  {
    type: "file",
    title: "Files & Images",
    description: "Configs, diagrams and screenshots, attached and searchable.",
  },
  {
    type: null,
    title: "Collections & Instant Search",
    description: "Group anything into collections and find it in milliseconds with ⌘K.",
  },
];

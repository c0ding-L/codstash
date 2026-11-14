import type { ItemTypeSlug } from "@/types/item-type";

/** The types whose content is code, shown and edited in the code editor. */
const CODE_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["snippet", "command"]);

export function isCodeType(slug: ItemTypeSlug | null): boolean {
  return slug !== null && CODE_TYPES.has(slug);
}

/** Short names people type for a language, mapped to the id Monaco knows it by. */
const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  node: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  golang: "go",
  cs: "csharp",
  "c#": "csharp",
  "c++": "cpp",
  cc: "cpp",
  kt: "kotlin",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  terminal: "shell",
  ps: "powershell",
  ps1: "powershell",
  pwsh: "powershell",
  yml: "yaml",
  md: "markdown",
  htm: "html",
  docker: "dockerfile",
  psql: "pgsql",
  postgres: "pgsql",
  postgresql: "pgsql",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

/**
 * The Monaco language id for an item's free-text `language` field. Unknown names pass
 * through lowercased (Monaco shows those as plain text); an empty one is plain text.
 */
export function toMonacoLanguage(language: string | null | undefined): string {
  const name = language?.trim().toLowerCase();
  if (!name) return "plaintext";
  return ALIASES[name] ?? name;
}

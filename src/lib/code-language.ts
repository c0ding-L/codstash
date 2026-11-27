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
  // Own entries only: `language` is free text, and `constructor` is on every object's prototype.
  return Object.hasOwn(ALIASES, name) ? ALIASES[name]! : name;
}

export interface LanguageOption {
  /** What is saved in the item's `language` field; empty for plain text. */
  value: string;
  label: string;
}

/** The languages the item forms offer, each saved as its Monaco id. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: "", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "shell", label: "Shell" },
  { value: "powershell", label: "PowerShell" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "graphql", label: "GraphQL" },
];

/**
 * The options for a form whose language is `current`. A language saved before the list
 * existed, and not in it, is added as it was typed so the form keeps it.
 */
export function languageOptionsFor(current: string): readonly LanguageOption[] {
  if (LANGUAGE_OPTIONS.some((option) => option.value === current)) return LANGUAGE_OPTIONS;
  return [...LANGUAGE_OPTIONS, { value: current, label: current }];
}

/** The label the code editor's header shows for a saved language. */
export function languageLabel(language: string | null | undefined): string {
  const value = language ?? "";
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** File extensions by Monaco language id, for exported snippets and commands. */
const EXTENSIONS: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  java: "java",
  csharp: "cs",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  shell: "sh",
  powershell: "ps1",
  sql: "sql",
  pgsql: "sql",
  mysql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  yaml: "yml",
  xml: "xml",
  markdown: "md",
  dockerfile: "dockerfile",
  graphql: "graphql",
  plaintext: "txt",
};

/**
 * The extension (without the dot) for an item's free-text `language`, through the same
 * aliases as the editor. `fallback` when the language is empty or unknown.
 */
export function extensionForLanguage(language: string | null | undefined, fallback = "txt"): string {
  if (!language?.trim()) return fallback;
  const id = toMonacoLanguage(language);
  return Object.hasOwn(EXTENSIONS, id) ? EXTENSIONS[id]! : fallback;
}

/** Extensions that are not an alias of a listed language, for imported files. */
const EXTRA_EXTENSIONS: Record<string, string> = {
  mts: "typescript",
  cts: "typescript",
  pyw: "python",
  h: "c",
  hpp: "cpp",
  hh: "cpp",
  cxx: "cpp",
  kts: "kotlin",
  yaml: "yaml",
  gql: "graphql",
  psm1: "powershell",
};

/** The languages the forms offer, by value, for the import lookups below. */
const LISTED_LANGUAGES: ReadonlySet<string> = new Set(
  LANGUAGE_OPTIONS.map((option) => option.value).filter(Boolean),
);

/** Extension to language: the reverse of `EXTENSIONS`, the first language winning (`sql`). */
const LANGUAGE_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS)
    .filter(([language]) => LISTED_LANGUAGES.has(language))
    .reverse()
    .map(([language, extension]) => [extension, language]),
);

/**
 * The listed language (`LANGUAGE_OPTIONS`) of a file extension, with or without its dot, for
 * an imported file. Null when the extension is not a known code language.
 */
export function languageForExtension(extension: string): string | null {
  const ext = extension.trim().toLowerCase().replace(/^\./, "");
  if (!ext) return null;
  if (Object.hasOwn(LANGUAGE_BY_EXTENSION, ext)) return LANGUAGE_BY_EXTENSION[ext]!;
  if (Object.hasOwn(EXTRA_EXTENSIONS, ext)) return EXTRA_EXTENSIONS[ext]!;
  const aliased = Object.hasOwn(ALIASES, ext) ? ALIASES[ext]! : null;
  return aliased && LISTED_LANGUAGES.has(aliased) ? aliased : null;
}

/**
 * The listed language of a language name such as GitHub's ("TypeScript", "C#", "Shell"):
 * a label, a value or an alias, ignoring case. Null when it is not one the forms offer.
 */
export function languageForName(name: string | null | undefined): string | null {
  const wanted = name?.trim().toLowerCase();
  if (!wanted) return null;
  const option = LANGUAGE_OPTIONS.find(
    (candidate) => candidate.value && (candidate.label.toLowerCase() === wanted || candidate.value === wanted),
  );
  if (option) return option.value;
  const aliased = toMonacoLanguage(wanted);
  return LISTED_LANGUAGES.has(aliased) ? aliased : null;
}

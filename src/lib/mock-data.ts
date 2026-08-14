/**
 * Single source of truth for mock data, used until the database is wired up.
 *
 * Shapes mirror the Prisma draft in `context/project-overview.md`, and the
 * values reproduce `context/screenshots/dashboard-ui-main.png`.
 *
 * Timestamps are fixed ISO strings anchored to MOCK_NOW rather than computed
 * from `Date.now()`: the dashboard is statically prerendered, so a relative
 * anchor would freeze at build time anyway while making builds nondeterministic.
 */

import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

export type { ColorToken, ItemTypeSlug } from "@/types/item-type";

/** Arbitrary anchor. Relative labels in the UI ("2h ago") are correct as of this date. */
export const MOCK_NOW = "2026-08-01T09:00:00.000Z";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Text items carry `content`; file items carry `fileUrl` / `fileName` / `fileSize`. */
export type ContentType = "text" | "file";

export interface User {
  id: string;
  name: string;
  /** Avatar fallback, shown when `image` is null. */
  initials: string;
  email: string;
  image: string | null;
  /** Free tier caps at 50 items / 3 collections, which this dataset exceeds. */
  isPro: boolean;
  createdAt: string;
}

export interface ItemType {
  id: string;
  slug: ItemTypeSlug;
  /** Singular label, used on item cards ("Snippet"). */
  name: string;
  /** Plural label, used in the sidebar ("Snippets"). */
  pluralName: string;
  /** lucide-react icon name. */
  icon: string;
  color: ColorToken;
  isSystem: boolean;
  /** Null for system types; set for Pro users' custom types. */
  userId: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
  userId: string;
  /**
   * Denormalized to match the design mock. The `items` array below is a
   * representative sample, not all 306 items — filtering `items` by
   * `collectionId` will NOT reproduce this number.
   */
  itemCount: number;
  /** Dominant type of the collection, used for its icon and accent color. */
  primaryTypeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  userId: string;
}

export interface Item {
  id: string;
  title: string;
  description: string | null;
  contentType: ContentType;
  /** Set when `contentType` is "text". */
  content: string | null;
  /** Set when `contentType` is "file". */
  fileUrl: string | null;
  fileName: string | null;
  /** Bytes. */
  fileSize: number | null;
  /** Set for link items. */
  url: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  /** Syntax highlighting hint for code items. */
  language: string | null;
  userId: string;
  typeId: string;
  collectionId: string | null;
  /** Flattened from the `ItemTag` join table in the Prisma draft. */
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

export const currentUser: User = {
  id: "usr_1",
  name: "CodStash",
  initials: "CS",
  email: "dev@codstash.io",
  image: null,
  isPro: true,
  createdAt: "2025-11-14T10:24:00.000Z",
};

/* -------------------------------------------------------------------------- */
/* Item types                                                                 */
/* -------------------------------------------------------------------------- */

export const itemTypes: ItemType[] = [
  {
    id: "typ_snippet",
    slug: "snippet",
    name: "Snippet",
    pluralName: "Snippets",
    icon: "Code2",
    color: "emerald",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_prompt",
    slug: "prompt",
    name: "Prompt",
    pluralName: "Prompts",
    icon: "Sparkles",
    color: "amber",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_note",
    slug: "note",
    name: "Note",
    pluralName: "Notes",
    icon: "FileText",
    color: "blue",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_command",
    slug: "command",
    name: "Command",
    pluralName: "Commands",
    icon: "SquareTerminal",
    color: "cyan",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_file",
    slug: "file",
    name: "File",
    pluralName: "Files",
    icon: "File",
    color: "rose",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_image",
    slug: "image",
    name: "Image",
    pluralName: "Images",
    icon: "Image",
    color: "violet",
    isSystem: true,
    userId: null,
  },
  {
    id: "typ_link",
    slug: "link",
    name: "Link",
    pluralName: "Links",
    icon: "Link",
    color: "yellow",
    isSystem: true,
    userId: null,
  },
];

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export const tags: Tag[] = [
  { id: "tag_react", name: "react", userId: "usr_1" },
  { id: "tag_hooks", name: "hooks", userId: "usr_1" },
  { id: "tag_typescript", name: "typescript", userId: "usr_1" },
  { id: "tag_ai", name: "ai", userId: "usr_1" },
  { id: "tag_llm", name: "llm", userId: "usr_1" },
  { id: "tag_architecture", name: "architecture", userId: "usr_1" },
  { id: "tag_postmortem", name: "post-mortem", userId: "usr_1" },
  { id: "tag_docker", name: "docker", userId: "usr_1" },
  { id: "tag_git", name: "git", userId: "usr_1" },
  { id: "tag_kubernetes", name: "kubernetes", userId: "usr_1" },
  { id: "tag_sql", name: "sql", userId: "usr_1" },
  { id: "tag_postgres", name: "postgres", userId: "usr_1" },
  { id: "tag_performance", name: "performance", userId: "usr_1" },
  { id: "tag_design", name: "design", userId: "usr_1" },
  { id: "tag_branding", name: "branding", userId: "usr_1" },
  { id: "tag_ui", name: "ui", userId: "usr_1" },
  { id: "tag_reading", name: "reading", userId: "usr_1" },
];

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

export const collections: Collection[] = [
  {
    id: "col_react_hooks",
    name: "React Hooks",
    description: "Reusable custom hooks for data fetching, forms and animation.",
    isFavorite: true,
    userId: "usr_1",
    itemCount: 42,
    primaryTypeId: "typ_snippet",
    createdAt: "2026-01-12T14:02:00.000Z",
    updatedAt: "2026-08-01T07:00:00.000Z", // 2h ago
  },
  {
    id: "col_system_prompts",
    name: "System Prompts",
    description: "Battle-tested LLM system prompts for agents and copilots.",
    isFavorite: true,
    userId: "usr_1",
    itemCount: 18,
    primaryTypeId: "typ_prompt",
    createdAt: "2026-02-03T09:41:00.000Z",
    updatedAt: "2026-08-01T04:00:00.000Z", // 5h ago
  },
  {
    id: "col_architecture_notes",
    name: "Architecture Notes",
    description: "Design decisions, RFCs and post-mortems for the platform.",
    isFavorite: false,
    userId: "usr_1",
    itemCount: 27,
    primaryTypeId: "typ_note",
    createdAt: "2025-12-19T16:30:00.000Z",
    updatedAt: "2026-07-31T07:00:00.000Z", // yesterday
  },
  {
    id: "col_shell_commands",
    name: "Shell Commands",
    description: "Docker, git and kubectl one-liners I never remember.",
    isFavorite: true,
    userId: "usr_1",
    itemCount: 64,
    primaryTypeId: "typ_command",
    createdAt: "2025-11-28T11:15:00.000Z",
    updatedAt: "2026-07-29T09:00:00.000Z", // 3d ago
  },
  {
    id: "col_design_assets",
    name: "Design Assets",
    description: "Exported icons, logos and brand files for the marketing site.",
    isFavorite: false,
    userId: "usr_1",
    itemCount: 12,
    primaryTypeId: "typ_file",
    createdAt: "2026-03-07T13:20:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z", // 1w ago
  },
  {
    id: "col_ui_inspiration",
    name: "UI Inspiration",
    description: "Screenshots and references for dashboard and editor patterns.",
    isFavorite: false,
    userId: "usr_1",
    itemCount: 89,
    primaryTypeId: "typ_image",
    createdAt: "2026-01-30T18:05:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z", // 1w ago
  },
  {
    id: "col_reading_list",
    name: "Reading List",
    description: "Engineering blogs, papers and docs worth revisiting.",
    isFavorite: false,
    userId: "usr_1",
    itemCount: 33,
    primaryTypeId: "typ_link",
    createdAt: "2025-12-02T08:50:00.000Z",
    updatedAt: "2026-07-18T09:00:00.000Z", // 2w ago
  },
  {
    id: "col_sql_snippets",
    name: "SQL Snippets",
    description: "Window functions, migrations and query optimizations.",
    isFavorite: false,
    userId: "usr_1",
    itemCount: 21,
    primaryTypeId: "typ_snippet",
    createdAt: "2026-04-21T15:12:00.000Z",
    updatedAt: "2026-07-16T09:00:00.000Z", // 2w ago
  },
];

/* -------------------------------------------------------------------------- */
/* Items                                                                      */
/* -------------------------------------------------------------------------- */

/** Base shared by every item, so each entry only spells out what differs. */
const itemDefaults = {
  description: null,
  content: null,
  fileUrl: null,
  fileName: null,
  fileSize: null,
  url: null,
  isFavorite: false,
  isPinned: false,
  language: null,
  userId: "usr_1",
  collectionId: null,
  tagIds: [] as string[],
} satisfies Partial<Item>;

export const items: Item[] = [
  /* --- React Hooks ------------------------------------------------------- */
  {
    ...itemDefaults,
    id: "itm_use_debounce",
    title: "useDebounce",
    description: "Debounce a fast-changing value before firing an effect.",
    contentType: "text",
    content: `export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
    isFavorite: true,
    isPinned: true,
    language: "typescript",
    typeId: "typ_snippet",
    collectionId: "col_react_hooks",
    tagIds: ["tag_react", "tag_hooks", "tag_typescript"],
    createdAt: "2026-05-18T10:12:00.000Z",
    updatedAt: "2026-08-01T07:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_use_local_storage",
    title: "useLocalStorage",
    description: "State that survives a reload, SSR-safe.",
    contentType: "text",
    content: `export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored) setValue(JSON.parse(stored) as T);
  }, [key]);

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}`,
    language: "typescript",
    typeId: "typ_snippet",
    collectionId: "col_react_hooks",
    tagIds: ["tag_react", "tag_hooks"],
    createdAt: "2026-04-02T09:30:00.000Z",
    updatedAt: "2026-07-22T14:45:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_use_intersection",
    title: "useIntersectionObserver",
    description: "Lazy-load and reveal-on-scroll without a library.",
    contentType: "text",
    content: `export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      options,
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}`,
    language: "typescript",
    typeId: "typ_snippet",
    collectionId: "col_react_hooks",
    tagIds: ["tag_react", "tag_hooks", "tag_performance"],
    createdAt: "2026-03-11T17:08:00.000Z",
    updatedAt: "2026-06-30T11:20:00.000Z",
  },

  /* --- System Prompts ---------------------------------------------------- */
  {
    ...itemDefaults,
    id: "itm_prompt_code_review",
    title: "Code Review Agent",
    description: "Reviews a diff and reports only high-confidence issues.",
    contentType: "text",
    content: `You are a senior engineer reviewing a pull request.

Report only issues you are confident about. For each one give:
- the file and line
- what breaks, with a concrete failing input
- the smallest fix

Do not comment on formatting, naming preferences, or anything a linter
already catches. If the diff is sound, say so and stop.`,
    isFavorite: true,
    isPinned: true,
    typeId: "typ_prompt",
    collectionId: "col_system_prompts",
    tagIds: ["tag_ai", "tag_llm"],
    createdAt: "2026-02-14T12:00:00.000Z",
    updatedAt: "2026-08-01T04:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_prompt_commit_message",
    title: "Commit Message Writer",
    description: "Turns a staged diff into a conventional commit.",
    contentType: "text",
    content: `Write a conventional commit message for the staged diff.

Format: <type>(<scope>): <subject>
Types: feat, fix, chore, docs, refactor, test, perf

Subject: imperative, lowercase, no trailing period, under 72 chars.
Add a body only when the "why" is not obvious from the subject.`,
    typeId: "typ_prompt",
    collectionId: "col_system_prompts",
    tagIds: ["tag_ai", "tag_git"],
    createdAt: "2026-03-22T08:15:00.000Z",
    updatedAt: "2026-07-11T16:02:00.000Z",
  },

  /* --- Architecture Notes ------------------------------------------------ */
  {
    ...itemDefaults,
    id: "itm_note_item_versioning",
    title: "RFC: Item versioning",
    description: "Keep every edit, or just the last N revisions?",
    contentType: "text",
    content: `# RFC: Item versioning

## Problem
Users edit snippets in place and lose the previous version.

## Options
1. Append-only \`ItemRevision\` table — full history, unbounded growth
2. Keep the last 10 revisions per item — bounded, silently lossy
3. No history, rely on export — cheapest, worst UX

## Leaning
Option 2 for the MVP. Free tier keeps 3 revisions, Pro keeps 10.`,
    typeId: "typ_note",
    collectionId: "col_architecture_notes",
    tagIds: ["tag_architecture"],
    createdAt: "2026-06-05T10:40:00.000Z",
    updatedAt: "2026-07-31T07:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_note_r2_postmortem",
    title: "Post-mortem: R2 upload timeouts",
    description: "Uploads over 8 MB failed for 40 minutes on 2026-07-09.",
    contentType: "text",
    content: `# Post-mortem: R2 upload timeouts

**Impact:** ~40 min, uploads over 8 MB returned 504.

**Cause:** presigned URLs were generated with a 30s expiry, shorter than
the upload itself on slow connections.

**Fix:** expiry raised to 15 min, and the client now requests a fresh URL
on 403 instead of surfacing the error.

**Follow-up:** alert on upload error rate above 1%.`,
    typeId: "typ_note",
    collectionId: "col_architecture_notes",
    tagIds: ["tag_architecture", "tag_postmortem"],
    createdAt: "2026-07-09T19:25:00.000Z",
    updatedAt: "2026-07-10T09:10:00.000Z",
  },

  /* --- Shell Commands ---------------------------------------------------- */
  {
    ...itemDefaults,
    id: "itm_cmd_docker_prune",
    title: "Reclaim disk from Docker",
    description: "Removes stopped containers, unused images and build cache.",
    contentType: "text",
    content: "docker system prune -a --volumes",
    isFavorite: true,
    language: "bash",
    typeId: "typ_command",
    collectionId: "col_shell_commands",
    tagIds: ["tag_docker"],
    createdAt: "2026-01-08T07:55:00.000Z",
    updatedAt: "2026-07-29T09:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_cmd_git_undo",
    title: "Undo the last commit, keep the changes",
    description: "Soft reset — files stay staged.",
    contentType: "text",
    content: "git reset --soft HEAD~1",
    language: "bash",
    typeId: "typ_command",
    collectionId: "col_shell_commands",
    tagIds: ["tag_git"],
    createdAt: "2026-01-08T08:02:00.000Z",
    updatedAt: "2026-05-14T13:30:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_cmd_kubectl_logs",
    title: "Tail logs from every pod of a deployment",
    contentType: "text",
    content: "kubectl logs -f -l app=codstash --all-containers --max-log-requests 10",
    language: "bash",
    typeId: "typ_command",
    collectionId: "col_shell_commands",
    tagIds: ["tag_kubernetes"],
    createdAt: "2026-02-27T14:18:00.000Z",
    updatedAt: "2026-06-19T10:05:00.000Z",
  },

  /* --- Design Assets ----------------------------------------------------- */
  {
    ...itemDefaults,
    id: "itm_file_logo",
    title: "CodStash logo",
    description: "Primary mark, light and dark variants.",
    contentType: "file",
    fileUrl: "/mock/assets/codstash-logo.svg",
    fileName: "codstash-logo.svg",
    fileSize: 14_208,
    typeId: "typ_file",
    collectionId: "col_design_assets",
    tagIds: ["tag_branding", "tag_design"],
    createdAt: "2026-03-07T13:25:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_file_brand_guidelines",
    title: "Brand guidelines",
    description: "Color, type scale and logo clear-space rules.",
    contentType: "file",
    fileUrl: "/mock/assets/brand-guidelines.pdf",
    fileName: "brand-guidelines.pdf",
    fileSize: 2_418_704,
    typeId: "typ_file",
    collectionId: "col_design_assets",
    tagIds: ["tag_branding", "tag_design"],
    createdAt: "2026-03-19T11:00:00.000Z",
    updatedAt: "2026-06-28T15:45:00.000Z",
  },

  /* --- UI Inspiration ---------------------------------------------------- */
  {
    ...itemDefaults,
    id: "itm_img_command_palette",
    title: "Linear command palette",
    description: "Grouping and keyboard hint placement worth stealing.",
    contentType: "file",
    fileUrl: "/mock/assets/linear-command-palette.png",
    fileName: "linear-command-palette.png",
    fileSize: 486_912,
    typeId: "typ_image",
    collectionId: "col_ui_inspiration",
    tagIds: ["tag_ui", "tag_design"],
    createdAt: "2026-05-02T20:10:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_img_raycast_grid",
    title: "Raycast extension grid",
    description: "Dense card grid that still breathes.",
    contentType: "file",
    fileUrl: "/mock/assets/raycast-extension-grid.png",
    fileName: "raycast-extension-grid.png",
    fileSize: 712_304,
    typeId: "typ_image",
    collectionId: "col_ui_inspiration",
    tagIds: ["tag_ui"],
    createdAt: "2026-04-16T18:44:00.000Z",
    updatedAt: "2026-06-11T09:22:00.000Z",
  },

  /* --- Reading List ------------------------------------------------------ */
  {
    ...itemDefaults,
    id: "itm_link_ddia",
    title: "Designing Data-Intensive Applications — chapter notes",
    description: "Replication and partitioning, condensed.",
    contentType: "text",
    url: "https://dataintensive.net",
    typeId: "typ_link",
    collectionId: "col_reading_list",
    tagIds: ["tag_reading", "tag_architecture"],
    createdAt: "2026-02-08T21:30:00.000Z",
    updatedAt: "2026-07-18T09:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_link_the_log",
    title: "The Log: What every software engineer should know",
    description: "Kreps on logs as the backbone of data systems.",
    contentType: "text",
    url: "https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying",
    typeId: "typ_link",
    collectionId: "col_reading_list",
    tagIds: ["tag_reading", "tag_architecture"],
    createdAt: "2026-01-25T12:14:00.000Z",
    updatedAt: "2026-05-30T08:40:00.000Z",
  },

  /* --- SQL Snippets ------------------------------------------------------ */
  {
    ...itemDefaults,
    id: "itm_sql_running_total",
    title: "Running total with a window function",
    description: "Cumulative sum per user, ordered by date.",
    contentType: "text",
    content: `SELECT
  user_id,
  created_at,
  amount,
  SUM(amount) OVER (
    PARTITION BY user_id
    ORDER BY created_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_total
FROM payments
ORDER BY user_id, created_at;`,
    language: "sql",
    typeId: "typ_snippet",
    collectionId: "col_sql_snippets",
    tagIds: ["tag_sql", "tag_postgres"],
    createdAt: "2026-04-21T15:20:00.000Z",
    updatedAt: "2026-07-16T09:00:00.000Z",
  },
  {
    ...itemDefaults,
    id: "itm_sql_slow_queries",
    title: "Find the slowest queries in Postgres",
    description: "Needs the pg_stat_statements extension.",
    contentType: "text",
    content: `SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;`,
    language: "sql",
    typeId: "typ_snippet",
    collectionId: "col_sql_snippets",
    tagIds: ["tag_sql", "tag_postgres", "tag_performance"],
    createdAt: "2026-05-09T16:35:00.000Z",
    updatedAt: "2026-06-27T10:50:00.000Z",
  },
];

/* -------------------------------------------------------------------------- */
/* Derived                                                                    */
/* -------------------------------------------------------------------------- */

/** Most recently updated collection first — drives the "Recent" sidebar. */
export const recentCollections: Collection[] = [...collections]
  .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  .slice(0, 5);

/** The four cards at the top of the dashboard. */
export const dashboardStats = {
  collectionCount: collections.length,
  /** Sum of the denormalized counts, not `items.length`. */
  totalItems: collections.reduce((total, c) => total + c.itemCount, 0),
  favoriteCount: collections.filter((c) => c.isFavorite).length,
  /**
   * Counted from the sample, so it is not comparable to `totalItems`: this is
   * "3 of the 18 items that exist here", while `totalItems` is the
   * denormalized 306. Real data makes the two consistent again.
   */
  favoriteItemCount: items.filter((i) => i.isFavorite).length,
  lastUpdated: recentCollections[0],
};

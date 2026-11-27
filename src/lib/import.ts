// Import (A4): turns a Cortex export, loose files or GitHub gists into item candidates. Pure
// and client-safe: the browser maps and batches (Vercel caps a request body at ~4.5 MB), and
// the server checks every candidate again with `checkCandidate`, never trusting the mapping.

import { z } from "zod";

import { languageForExtension, languageForName } from "@/lib/code-language";
import { EXPORT_FORMAT, EXPORT_VERSION } from "@/lib/export";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { collectionSchema, createItemSchema } from "@/lib/item-schemas";

export const IMPORT_TYPES = ["snippet", "note", "prompt", "command", "link"] as const;
export type ImportSystemType = (typeof IMPORT_TYPES)[number];

export type ImportConflict = "skip" | "duplicate";

export interface ImportCandidate {
  title: string;
  /** A system type, or a custom type by its slug: the server resolves it or falls back to a note. */
  type: ImportSystemType | { customSlug: string };
  content?: string | null;
  url?: string | null;
  language?: string | null;
  description?: string | null;
  tags: string[];
  /** Matched by name with the user's collections, created when missing. */
  collectionNames: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
}

/** A custom type as an export describes it, recreated for a Pro user who does not have it. */
export interface ImportTypeDef {
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  template: string | null;
}

/** A collection as an export describes it; the description is used only when it is created. */
export interface ImportCollectionDef {
  name: string;
  description: string | null;
}

/** Counts of what was left out, by reason. */
export interface ImportSkipped {
  duplicate: number;
  file: number;
  tooLong: number;
  invalid: number;
  limit: number;
}

export interface ImportResult {
  created: number;
  skipped: ImportSkipped;
  /** Titles of the invalid candidates, the first `MAX_INVALID_TITLES`. */
  invalidTitles: string[];
  collectionsCreated: number;
  /** Item-to-collection links left out because the collection could not be created (Free limit). */
  collectionLinksDropped: number;
}

/** What the browser sends to `POST /api/import`, one batch at a time. */
export interface ImportBatch {
  candidates: ImportCandidate[];
  conflict: ImportConflict;
  types: ImportTypeDef[];
  collections: ImportCollectionDef[];
}

/** A parsed source, before any batch is sent: the candidates plus what was skipped while reading. */
export interface ParsedImport {
  candidates: ImportCandidate[];
  types: ImportTypeDef[];
  collections: ImportCollectionDef[];
  result: ImportResult;
}

export const IMPORT_BATCH_MAX_ITEMS = 100;
/** What the browser stays under per request; the route refuses a body over `IMPORT_BODY_MAX_BYTES`. */
export const IMPORT_BATCH_MAX_BYTES = 3_000_000;
export const IMPORT_BODY_MAX_BYTES = 3_500_000;
export const MAX_INVALID_TITLES = 20;
export const MAX_GISTS_PER_IMPORT = 100;

/** The tag a custom-type item gets when it is imported as a note instead. */
export function fallbackTypeTag(slug: string): string {
  return `type:${slug}`;
}

export function emptyImportResult(): ImportResult {
  return {
    created: 0,
    skipped: { duplicate: 0, file: 0, tooLong: 0, invalid: 0, limit: 0 },
    invalidTitles: [],
    collectionsCreated: 0,
    collectionLinksDropped: 0,
  };
}

/** Adds `more` into `total`, for the browser summing the batches' reports. */
export function mergeImportResults(total: ImportResult, more: ImportResult): ImportResult {
  const skipped = { ...total.skipped };
  for (const key of Object.keys(skipped) as (keyof ImportSkipped)[]) skipped[key] += more.skipped[key];
  return {
    created: total.created + more.created,
    skipped,
    invalidTitles: [...total.invalidTitles, ...more.invalidTitles].slice(0, MAX_INVALID_TITLES),
    collectionsCreated: total.collectionsCreated + more.collectionsCreated,
    collectionLinksDropped: total.collectionLinksDropped + more.collectionLinksDropped,
  };
}

/** Records a candidate refused by `checkCandidate` in a report. */
export function countRefused(result: ImportResult, refused: { reason: "tooLong" | "invalid"; title: string }) {
  result.skipped[refused.reason] += 1;
  if (refused.reason === "invalid" && result.invalidTitles.length < MAX_INVALID_TITLES) {
    result.invalidTitles.push(refused.title.slice(0, ITEM_LIMITS.title) || "(untitled)");
  }
}

const optionalString = z.string().nullable().optional();

/** The structure of a candidate; the field rules come from the item schemas afterwards. */
const candidateShape = z.object({
  title: z.string(),
  type: z.union([z.enum(IMPORT_TYPES), z.object({ customSlug: z.string().trim().min(1).max(100) })]),
  content: optionalString,
  url: optionalString,
  language: optionalString,
  description: optionalString,
  tags: z.array(z.string()).default([]),
  collectionNames: z.array(z.string()).default([]),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export type CandidateCheck =
  | { ok: true; candidate: ImportCandidate }
  | { ok: false; reason: "tooLong" | "invalid"; title: string };

/**
 * Checks one candidate with the rules `createItem` applies: the same schemas, so an import
 * cannot store what the form would refuse (a `javascript:` link, an over-long field). Content
 * over the cap is `tooLong`, anything else refused is `invalid`. The candidate comes back
 * normalised (trimmed title, blanks as null, fields its type does not use dropped).
 */
export function checkCandidate(raw: unknown): CandidateCheck {
  const rawTitle =
    typeof raw === "object" && raw !== null && "title" in raw && typeof raw.title === "string" ? raw.title : "";
  const shaped = candidateShape.safeParse(raw);
  if (!shaped.success) return { ok: false, reason: "invalid", title: rawTitle };
  const input = shaped.data;

  if ((input.content?.length ?? 0) > ITEM_LIMITS.content) return { ok: false, reason: "tooLong", title: input.title };

  const fields = {
    title: input.title,
    description: input.description,
    content: input.content,
    url: input.url,
    language: input.language,
    tags: input.tags,
    collectionIds: [],
  };
  // A custom type is validated in its own shape; its id is resolved on the server.
  const parsed = createItemSchema.safeParse(
    typeof input.type === "string" ? { ...fields, type: input.type } : { ...fields, type: "custom", typeId: "import" },
  );
  if (!parsed.success) return { ok: false, reason: "invalid", title: input.title };

  const names: string[] = [];
  for (const name of input.collectionNames) {
    const checked = collectionSchema.shape.name.safeParse(name);
    if (!checked.success) return { ok: false, reason: "invalid", title: input.title };
    if (!names.some((seen) => sameCollectionName(seen, checked.data))) names.push(checked.data);
  }
  if (names.length > ITEM_LIMITS.collections) return { ok: false, reason: "invalid", title: input.title };

  const data = parsed.data;
  const candidate: ImportCandidate = {
    title: data.title,
    type: typeof input.type === "string" ? input.type : { customSlug: input.type.customSlug },
    description: data.description ?? null,
    tags: [...new Set(data.tags)],
    collectionNames: names,
    ...("content" in data && { content: data.content ?? null }),
    ...("url" in data && { url: data.url }),
    ...("language" in data && { language: data.language ?? null }),
    ...(input.isFavorite !== undefined && { isFavorite: input.isFavorite }),
    ...(input.isPinned !== undefined && { isPinned: input.isPinned }),
  };
  return { ok: true, candidate };
}

/** Collection names match ignoring case and surrounding spaces. */
export function sameCollectionName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Runs `checkCandidate` over a list and starts the report with what it refused. */
function checkAll(raw: unknown[], result: ImportResult): ImportCandidate[] {
  const candidates: ImportCandidate[] = [];
  for (const item of raw) {
    const checked = checkCandidate(item);
    if (checked.ok) candidates.push(checked.candidate);
    else countRefused(result, checked);
  }
  return candidates;
}

export class ImportFormatError extends Error {
  constructor() {
    super("Not a Cortex export (format or version).");
    this.name = "ImportFormatError";
  }
}

const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  types: z
    .array(
      z.object({
        slug: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
        color: z.string().nullable(),
        template: z.string().nullable(),
      }),
    )
    .default([]),
  collections: z
    .array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable().optional() }))
    .default([]),
  items: z.array(
    z.looseObject({
      type: z.string(),
      collectionIds: z.array(z.string()).default([]),
    }),
  ),
});

/**
 * The candidates of a Cortex export (A1). Throws `ImportFormatError` for anything that is not
 * a version 1 export. File and image items are skipped, since their bytes are not in the JSON.
 */
export function fromCortexExport(json: unknown): ParsedImport {
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new ImportFormatError();
  const { types, collections, items } = parsed.data;

  const result = emptyImportResult();
  const collectionNames = new Map(collections.map((collection) => [collection.id, collection.name]));
  const raw: unknown[] = [];
  for (const { type, collectionIds, ...item } of items) {
    if (type === "file" || type === "image") {
      result.skipped.file += 1;
      continue;
    }
    raw.push({
      title: item.title,
      type: (IMPORT_TYPES as readonly string[]).includes(type) ? type : { customSlug: type },
      content: item.content,
      url: item.url,
      language: item.language,
      description: item.description,
      tags: item.tags ?? [],
      collectionNames: collectionIds.flatMap((id) => collectionNames.get(id) ?? []),
      isFavorite: item.isFavorite,
      isPinned: item.isPinned,
    });
  }

  return {
    candidates: checkAll(raw, result),
    types,
    collections: collections.map(({ name, description }) => ({ name, description: description ?? null })),
    result,
  };
}

/** The extension of a file name, lowercased and without the dot; empty for none or a dotfile. */
function extensionOf(name: string): string {
  const base = baseName(name);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** The name without any folder part. */
function baseName(name: string): string {
  return name.split(/[\\/]/).pop() ?? name;
}

/** The title of an imported file: its name without the extension, or the whole name for a dotfile. */
function titleOf(name: string): string {
  const base = baseName(name);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

const NOTE_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const COMMAND_EXTENSIONS = new Set(["sh", "ps1", "bat"]);

/** The type and language a loose file imports as, or null for an extension it does not take. */
export function detectFileType(name: string): { type: "note" | "snippet" | "command"; language: string | null } | null {
  const ext = extensionOf(name);
  if (NOTE_EXTENSIONS.has(ext)) return { type: "note", language: null };
  if (COMMAND_EXTENSIONS.has(ext)) return { type: "command", language: languageForExtension(ext) };
  const language = languageForExtension(ext);
  return language && language !== "markdown" ? { type: "snippet", language } : null;
}

/** The file types the Files tab accepts, for the picker's `accept`. */
export function isImportableFileName(name: string): boolean {
  return detectFileType(name) !== null;
}

/**
 * One loose file as a candidate: `.md`/`.txt` a note, a code file a snippet with its language,
 * `.sh`/`.ps1`/`.bat` a command. Null for a file type it does not take. `type` overrides the
 * detected one (the preview list lets the user change it).
 */
export function fromLooseFile(name: string, text: string, type?: "note" | "snippet" | "command"): CandidateCheck | null {
  const detected = detectFileType(name);
  if (!detected) return null;
  const chosen = type ?? detected.type;
  return checkCandidate({
    title: titleOf(name),
    type: chosen,
    content: text,
    language: chosen === "note" ? null : detected.language,
    tags: [],
    collectionNames: [],
  });
}

/** A gist as `GET /gists/{id}` returns it, with every file's content already in place. */
export interface GistDetail {
  id: string;
  description: string | null;
  files: Record<string, { filename: string; language: string | null; content: string } | null>;
}

/**
 * One candidate per file of a gist, tagged `gist` and described by the gist's description.
 * Markdown files become notes; the others snippets, with GitHub's language when the forms
 * list it, else the extension's.
 */
export function fromGist(gist: GistDetail): CandidateCheck[] {
  return Object.values(gist.files).flatMap((file) => {
    if (!file) return [];
    const ext = extensionOf(file.filename);
    const language = languageForName(file.language) ?? languageForExtension(ext);
    const isMarkdown = language === "markdown" || ext === "md" || ext === "markdown";
    return [
      checkCandidate({
        title: titleOf(file.filename),
        type: isMarkdown ? "note" : "snippet",
        content: file.content,
        language: isMarkdown ? null : language,
        description: gist.description,
        tags: ["gist"],
        collectionNames: [],
      }),
    ];
  });
}

/** The size of a value as the request body will carry it: UTF-8 bytes of its JSON. */
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Splits a parsed import into request bodies: at most `IMPORT_BATCH_MAX_ITEMS` candidates and
 * under `IMPORT_BATCH_MAX_BYTES` each, measured in UTF-8. Each batch carries only the type and
 * collection definitions its candidates name.
 */
export function toImportBatches(
  { candidates, types, collections }: Pick<ParsedImport, "candidates" | "types" | "collections">,
  conflict: ImportConflict,
  limits = { maxItems: IMPORT_BATCH_MAX_ITEMS, maxBytes: IMPORT_BATCH_MAX_BYTES },
): ImportBatch[] {
  const batches: ImportBatch[] = [];
  let current: ImportCandidate[] = [];
  let currentBytes = 0;

  const finish = () => {
    if (current.length === 0) return;
    batches.push(withDefinitions(current, conflict, types, collections));
    current = [];
    currentBytes = 0;
  };

  for (const candidate of candidates) {
    // Each candidate's own definitions are counted with it, an upper bound on what the batch holds.
    const bytes = jsonBytes(withDefinitions([candidate], conflict, types, collections)) + 1;
    if (current.length > 0 && (current.length >= limits.maxItems || currentBytes + bytes > limits.maxBytes)) finish();
    current.push(candidate);
    currentBytes += bytes;
  }
  finish();
  return batches;
}

function withDefinitions(
  candidates: ImportCandidate[],
  conflict: ImportConflict,
  types: ImportTypeDef[],
  collections: ImportCollectionDef[],
): ImportBatch {
  const slugs = new Set(candidates.flatMap((c) => (typeof c.type === "string" ? [] : [c.type.customSlug])));
  const names = candidates.flatMap((c) => c.collectionNames);
  return {
    candidates,
    conflict,
    types: types.filter((type) => slugs.has(type.slug)),
    collections: collections.filter((collection) => names.some((name) => sameCollectionName(name, collection.name))),
  };
}

/** The body of `POST /api/import`: only the envelope here, each entry is checked on its own. */
export const importBatchSchema = z.object({
  candidates: z.array(z.unknown()).min(1).max(IMPORT_BATCH_MAX_ITEMS),
  conflict: z.enum(["skip", "duplicate"]),
  types: z.array(z.unknown()).max(IMPORT_BATCH_MAX_ITEMS).default([]),
  collections: z.array(z.unknown()).max(IMPORT_BATCH_MAX_ITEMS * ITEM_LIMITS.collections).default([]),
});

/** A file larger than this is over the content cap without reading it: UTF-8 is at most 4 bytes a character. */
export const MAX_FILL_FILE_BYTES = ITEM_LIMITS.content * 4;

/** What a file fills in the New item form. */
export interface FileFill {
  title: string;
  content: string;
  language: string | null;
}

export type FormFill = FileFill | { error: "unsupported" | "tooLong" };

/**
 * What a local file fills in the New item form, whose type the user already chose: the title
 * (the name without its extension), the content and, when `withLanguage`, the language its
 * extension gives (null when the extension names none). Same file types and content cap as
 * the import's Files tab.
 */
export function fileToFormFill(name: string, text: string, { withLanguage }: { withLanguage: boolean }): FormFill {
  if (!isImportableFileName(name)) return { error: "unsupported" };
  if (text.length > ITEM_LIMITS.content) return { error: "tooLong" };
  return {
    title: titleOf(name).slice(0, ITEM_LIMITS.title),
    content: text,
    language: withLanguage ? languageForExtension(extensionOf(name)) : null,
  };
}

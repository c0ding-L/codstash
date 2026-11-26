// The data export (`/api/export`): the versioned JSON document and the ZIP's entry names
// and bodies. Pure, so the shape is tested without a database; the route and
// `export-zip.ts` feed it rows from `src/lib/db/export.ts`.

import { extensionForLanguage } from "@/lib/code-language";
import { shortId } from "@/lib/utils";

export const EXPORT_FORMAT = "cortex-export";
/** Bumped on any change that import (A4) would read differently. */
export const EXPORT_VERSION = 1;

export type ExportFormat = "json" | "zip";

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "json" || value === "zip";
}

/** One item as the database layer reads it. `fileUrl` is the R2 key: used for the ZIP, never exported. */
export interface ExportItemRow {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string | null;
  url: string | null;
  language: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  fileName: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  type: { slug: string; isSystem: boolean };
  tags: string[];
  collectionIds: string[];
}

export interface ExportCollectionRow {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportTypeRow {
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface ExportUserRow {
  name: string | null;
  email: string;
  locale: string | null;
}

/** Everything in the document except the items, which are streamed after it. */
export interface ExportHeader {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  user: ExportUserRow;
  types: ExportTypeRow[];
  collections: (Omit<ExportCollectionRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string })[];
}

export interface ExportItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  contentType: string;
  content: string | null;
  url: string | null;
  language: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  tags: string[];
  collectionIds: string[];
  file: { name: string; size: number | null } | null;
  createdAt: string;
  updatedAt: string;
}

export function exportHeader({
  user,
  types,
  collections,
  exportedAt,
}: {
  user: ExportUserRow;
  types: ExportTypeRow[];
  collections: ExportCollectionRow[];
  exportedAt: Date;
}): ExportHeader {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    user: { name: user.name, email: user.email, locale: user.locale },
    types: types.map(({ slug, name, icon, color }) => ({ slug, name, icon, color })),
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    })),
  };
}

export function exportItem(row: ExportItemRow): ExportItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type.slug,
    contentType: row.contentType,
    content: row.content,
    url: row.url,
    language: row.language,
    isFavorite: row.isFavorite,
    isPinned: row.isPinned,
    tags: row.tags,
    collectionIds: row.collectionIds,
    file: row.fileName === null ? null : { name: row.fileName, size: row.fileSize },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The JSON document, written piece by piece so a large stash never sits in memory as
 * one string: the header up to `"items":[`, then one item at a time, then `]}`.
 */
export async function* exportJsonChunks(
  header: ExportHeader,
  itemPages: AsyncIterable<ExportItemRow[]>,
): AsyncGenerator<string> {
  // The header always has keys, so its JSON ends with "}" and can be reopened.
  yield `${JSON.stringify(header).slice(0, -1)},"items":[`;
  let first = true;
  for await (const page of itemPages) {
    for (const row of page) {
      yield `${first ? "" : ","}${JSON.stringify(exportItem(row))}`;
      first = false;
    }
  }
  yield "]}";
}

const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f/\\:*?"<>|]/g;

/**
 * A title or file name made safe as a ZIP entry name on every OS: no path separators,
 * reserved or control characters, no leading dot, no trailing dot or space, at most
 * `max` characters (keeping a short extension), never empty.
 */
export function safeFileName(name: string, max = 80): string {
  const cleaned = name
    .normalize("NFC")
    .replace(UNSAFE_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  // An extension only after some name: ".bashrc" stripped to "bashrc" has none.
  const extension = /.(\.[A-Za-z0-9]{1,10})$/.exec(cleaned)?.[1] ?? "";
  const stem = extension ? cleaned.slice(0, -extension.length) : cleaned;

  // By code points, so an emoji is never cut in half.
  const room = Math.max(1, max - extension.length);
  const short = Array.from(stem).slice(0, room).join("").replace(/[.\s]+$/, "");
  if (!short) return extension ? `untitled${extension}` : "untitled";
  return `${short}${extension}`;
}

/** The folder a text item goes in: the type's slug, plural. */
function folderFor(slug: string) {
  return `${safeFileName(slug, 40)}s`;
}

/** Whether the item's body is written to `items/` in the ZIP: everything but files, images and links. */
export function isTextEntry(row: Pick<ExportItemRow, "contentType" | "type">) {
  return row.contentType !== "file" && row.type.slug !== "link";
}

/** `items/<type>s/<title>-<id8>.<ext>`: unique through the id's random end. */
export function itemEntryPath(row: Pick<ExportItemRow, "id" | "title" | "language" | "type">) {
  const { slug } = row.type;
  const extension =
    slug === "snippet" || slug === "command"
      ? extensionForLanguage(row.language, slug === "command" ? "sh" : "txt")
      : "md";
  return `items/${folderFor(slug)}/${safeFileName(row.title)}-${shortId(row.id)}.${extension}`;
}

/** `files/<id8>-<original name>`: the stored file, under its own name. */
export function fileEntryPath(row: Pick<ExportItemRow, "id" | "fileName">) {
  return `files/${shortId(row.id)}-${safeFileName(row.fileName ?? "file", 120)}`;
}

/** The body of an item's file in `items/`: its content as saved, with a final newline. */
export function renderItemText(row: Pick<ExportItemRow, "content">) {
  const content = row.content ?? "";
  return content.endsWith("\n") || content === "" ? content : `${content}\n`;
}

/** `links.md`: every link as a Markdown list. The URL is wrapped in `<>` so spaces and parentheses survive. */
export function linksMarkdown(links: Pick<ExportItemRow, "title" | "url" | "description">[]) {
  const lines = links.map(({ title, url, description }) => {
    const label = title.replace(/[[\]\\]/g, "\\$&");
    const target = (url ?? "").replace(/[<>\s]/g, (character) => encodeURIComponent(character));
    const suffix = description?.trim() ? `: ${description.trim().replace(/\s+/g, " ")}` : "";
    return `- [${label}](<${target}>)${suffix}`;
  });
  return `# Links\n\n${lines.join("\n")}\n`;
}

/** `cortex-export-2026-11-26.zip`, dated in UTC. */
export function exportFileName(format: ExportFormat, date: Date) {
  return `cortex-export-${date.toISOString().slice(0, 10)}.${format}`;
}

/** The `filename="…"` of a `Content-Disposition` header, made safe again; `fallback` without one. */
export function filenameFromDisposition(header: string | null, fallback: string) {
  const name = header ? /filename="([^"]+)"/.exec(header)?.[1] : undefined;
  return name ? safeFileName(name, 120) : fallback;
}

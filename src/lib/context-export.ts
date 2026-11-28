// The context export (`/api/collections/[id]/context`): one collection as a single Markdown
// file for an AI coding assistant. Pure, so the layout is tested without a database.
//
// Section headings are in English whatever the UI language: the file is read by an AI, and
// the user's own text (the description, every item) goes out exactly as written.

import { linkLine, renderItemText, safeFileName } from "@/lib/export";
import { attachmentDisposition } from "@/lib/files";
import { formatFileSize } from "@/lib/format";

/** The whole file stays under this many characters; past it, it stops at an item boundary. */
export const CONTEXT_MAX_CHARS = 400_000;

/** "Copy as context" refuses past this many characters and suggests the download instead. */
export const CONTEXT_COPY_MAX_CHARS = 200_000;

export interface ContextCollectionRow {
  name: string;
  description: string | null;
}

export interface ContextItemRow {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  fileName: string | null;
  fileSize: number | null;
  updatedAt: Date;
  type: { slug: string; name: string; isSystem: boolean };
}

type ItemKind = "code" | "note" | "link" | "file";

interface Section {
  heading: string;
  kind: ItemKind;
  /** The fence's info string for code sections; a function of the item. */
  info?: (item: ContextItemRow) => string;
}

/** The system sections before the custom types, in order. */
const LEADING_SECTIONS: Record<string, Section> = {
  snippet: { heading: "Snippets", kind: "code", info: (item) => item.language?.trim() ?? "" },
  command: { heading: "Commands", kind: "code", info: (item) => item.language?.trim() || "bash" },
  prompt: { heading: "Prompts", kind: "code", info: () => "text" },
  note: { heading: "Notes", kind: "note" },
};

/** Files and images share one section: names only. */
const FILES_SECTION: Section = { heading: "Files", kind: "file" };

/** The system sections after the custom types. */
const TRAILING_SECTIONS: Record<string, Section> = {
  link: { heading: "Links", kind: "link" },
  file: FILES_SECTION,
  image: FILES_SECTION,
};

/** A backtick fence longer than any run of backticks in `content`, so the content cannot close it. */
export function fenceFor(content: string): string {
  let longest = 0;
  for (const run of content.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(3, longest + 1));
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^( {0,3})(#{1,6})(?=[ \t]|$)/;

/**
 * Moves every ATX heading of `markdown` down `by` levels (at most `######`), so a note's
 * `# Title` sits under the file's `### item` heading. Lines inside fenced code are left
 * alone: a `# comment` in a shell block is not a heading. A fence left open at the end is
 * closed, so it cannot swallow the rest of the file.
 */
export function shiftHeadings(markdown: string, by = 2): string {
  let fence: { char: string; length: number } | null = null;
  const shifted = markdown
    .split("\n")
    .map((line) => {
      const marker = FENCE_OPEN.exec(line)?.[1];
      if (fence) {
        // A closing fence: same character, at least as long, nothing after it.
        if (marker && marker[0] === fence.char && marker.length >= fence.length && line.trim() === marker) {
          fence = null;
        }
        return line;
      }
      if (marker) {
        fence = { char: marker[0]!, length: marker.length };
        return line;
      }
      return line.replace(HEADING, (_, indent: string, hashes: string) =>
        `${indent}${"#".repeat(Math.min(6, hashes.length + by))}`,
      );
    })
    .join("\n");

  // Read after the map: TypeScript does not see the callback reassign it.
  const open = fence as { char: string; length: number } | null;
  if (!open) return shifted;
  return `${shifted}${shifted.endsWith("\n") ? "" : "\n"}${open.char.repeat(open.length)}`;
}

/** The item's own description, as a paragraph after its heading; empty without one. */
function descriptionBlock(item: ContextItemRow) {
  const description = item.description?.trim();
  return description ? `${description}\n\n` : "";
}

function renderItem(item: ContextItemRow, section: Section): string {
  switch (section.kind) {
    case "code": {
      const body = renderItemText(item);
      const fence = fenceFor(body);
      return `### ${item.title}\n\n${descriptionBlock(item)}${fence}${section.info?.(item) ?? ""}\n${body}${fence}\n`;
    }
    case "note": {
      const body = renderItemText({ content: shiftHeadings(item.content ?? "") });
      return `### ${item.title}\n\n${descriptionBlock(item)}${body}`;
    }
    case "link":
      return `${linkLine(item)}\n`;
    case "file": {
      const name = item.fileName ?? item.title;
      return item.fileSize === null ? `- ${name}\n` : `- ${name} (${formatFileSize(item.fileSize, "en")})\n`;
    }
  }
}

/** Code and note items are blocks, separated by a blank line; links and files are list lines. */
function isBlock(section: Section) {
  return section.kind === "code" || section.kind === "note";
}

const byUpdatedDesc = (a: ContextItemRow, b: ContextItemRow) => b.updatedAt.getTime() - a.updatedAt.getTime();

/** The items grouped into their sections, in the file's order, empty sections left out. */
function groupSections(items: ContextItemRow[]): { section: Section; items: ContextItemRow[] }[] {
  const groups = new Map<Section | string, { section: Section; items: ContextItemRow[] }>();
  const sectionOf = (item: ContextItemRow): Section | string => {
    if (item.type.isSystem) {
      const known = LEADING_SECTIONS[item.type.slug] ?? TRAILING_SECTIONS[item.type.slug];
      if (known) return known;
    }
    // A custom type, keyed by its name, rendered as a note.
    return `custom:${item.type.name}`;
  };

  for (const item of items) {
    const key = sectionOf(item);
    let group = groups.get(key);
    if (!group) {
      const section = typeof key === "string" ? { heading: item.type.name, kind: "note" as const } : key;
      group = { section, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  const customKeys = [...groups.keys()]
    .filter((key): key is string => typeof key === "string")
    .sort((a, b) => a.localeCompare(b, "en"));
  const order = [
    ...new Set(Object.values(LEADING_SECTIONS)),
    ...customKeys,
    ...new Set(Object.values(TRAILING_SECTIONS)),
  ];

  return order.flatMap((key) => {
    const group = groups.get(key);
    return group ? [{ section: group.section, items: [...group.items].sort(byUpdatedDesc) }] : [];
  });
}

function truncationLine(count: number) {
  return `\n_Truncated: ${count} more ${count === 1 ? "item" : "items"} not included._\n`;
}

/** Room kept for the truncation line, so the file with it still fits under the cap. */
const TRUNCATION_RESERVE = truncationLine(Number.MAX_SAFE_INTEGER).length;

/**
 * The collection as one Markdown file: its name and description, then its items by type.
 * Over `maxChars`, the file stops before the first item that does not fit and says how many
 * were left out.
 */
export function renderCollectionContext({
  collection,
  items,
  exportedAt,
  maxChars = CONTEXT_MAX_CHARS,
}: {
  collection: ContextCollectionRow;
  items: ContextItemRow[];
  exportedAt: Date;
  maxChars?: number;
}): string {
  const description = collection.description?.trim();
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  const header =
    `# ${collection.name}\n\n` +
    (description ? `${description}\n\n` : "") +
    `_Exported from Cortex on ${exportedAt.toISOString().slice(0, 10)}. ${count}._\n`;

  // One chunk per item; the first item of a section carries the section's heading, so a
  // truncated file never ends on an empty heading.
  const chunks = groupSections(items).flatMap(({ section, items: sectionItems }) =>
    sectionItems.map((item, index) => {
      const lead = index === 0 ? `\n## ${section.heading}\n\n` : isBlock(section) ? "\n" : "";
      return `${lead}${renderItem(item, section)}`;
    }),
  );

  const full = header + chunks.join("");
  if (full.length <= maxChars) return full;

  let output = header;
  let included = 0;
  for (const chunk of chunks) {
    if (output.length + chunk.length > maxChars - TRUNCATION_RESERVE) break;
    output += chunk;
    included += 1;
  }
  return output + truncationLine(items.length - included);
}

/** `React hooks-context.md`: the collection's name, made safe as a file name. */
export function contextFileName(collectionName: string) {
  return `${safeFileName(collectionName)}-context.md`;
}

/** The `Content-Disposition` of the download: a collection name can hold any character. */
export function contextDisposition(collectionName: string) {
  return attachmentDisposition(contextFileName(collectionName));
}

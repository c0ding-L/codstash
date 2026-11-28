// The MCP server's tools (C3), as plain functions of the caller and the tool's input, so they
// are tested without the transport. Server-only. Output is English Markdown-ish text for the
// model; the user's own content goes out exactly as written.

import { z } from "zod";

import type { ApiCaller } from "@/lib/api-auth";
import { createItemFromApi } from "@/lib/api-create-item";
import { englishIssues } from "@/lib/api-v1";
import { fenceFor, renderCollectionContext } from "@/lib/context-export";
import { getApiItem, listApiCollections, listApiItems, type ApiItem } from "@/lib/db/api-items";
import { getCollectionContextData } from "@/lib/db/context-export";
import { renderItemText } from "@/lib/export";
import { formatFileSize } from "@/lib/format";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { checkRateLimit, secondsUntil } from "@/lib/rate-limit";
import { scanItem, type ScannableItem, type SecretKind } from "@/lib/secrets";
import { canUseApiWrite } from "@/lib/usage-limits";
import { truncate } from "@/lib/utils";

/** What a tool answers: one text block, flagged when it is an error. */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: true;
}

export const SEARCH_MAX_LIMIT = 20;
const SEARCH_DEFAULT_LIMIT = 10;
/** Characters of content shown under each search result. */
export const SEARCH_PREVIEW_CHARS = 200;
/** `get_collection_context` stays under this many characters: an assistant's context is not a download. */
export const MCP_CONTEXT_MAX_CHARS = 100_000;

const text = (value: string): ToolResult => ({ content: [{ type: "text", text: value }] });
const toolError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

/** The line added when something looks like a secret; empty when nothing does. */
export function secretWarning(items: ScannableItem[]): string {
  const kinds = [...new Set(items.flatMap((item) => scanItem(item).map((finding) => finding.kind)))] as SecretKind[];
  return kinds.length > 0 ? `⚠ Possible secret detected (${kinds.join(", ")}). Review it in Cortex.` : "";
}

function withWarning(body: string, items: ScannableItem[]): string {
  const warning = secretWarning(items);
  return warning ? `${warning}\n\n${body}` : body;
}

/** Runs a tool, turning an unexpected throw into a short tool error. */
async function guard(name: string, run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[mcp] ${name} failed:`, error);
    return toolError("Something went wrong in Cortex. Try again.");
  }
}

// ── Input schemas ──────────────────────────────────────────────────────────────────────────

const idField = (what: string) => z.string().trim().min(1).max(100).describe(`The ${what}'s id, as another tool returned it.`);

export const searchItemsInput = z.object({
  query: z.string().trim().min(1).max(200).describe("Words to look for in titles, descriptions and content, or an exact tag name."),
  type: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe("Only this item type: snippet, prompt, command, note, link, file, image, or a custom type's slug."),
  tag: z.string().trim().max(ITEM_LIMITS.tag).optional().describe("Only items with this exact tag."),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`How many results, at most ${SEARCH_MAX_LIMIT} (default ${SEARCH_DEFAULT_LIMIT}).`),
});

export const getItemInput = z.object({ id: idField("item") });

export const getCollectionContextInput = z.object({ id: idField("collection") });

export const createItemInput = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("snippet, prompt, note, command, link, or the slug of one of the user's custom types."),
  title: z.string().describe("A short, specific title."),
  content: z.string().optional().describe("The text: code for a snippet or command, Markdown for a note. Not used by links."),
  url: z.string().optional().describe("The address, for a link only (required for links)."),
  language: z.string().optional().describe("The code's language, for a snippet or command (e.g. typescript, bash)."),
  tags: z.array(z.string()).optional().describe(`Up to ${ITEM_LIMITS.tags} tags.`),
  collectionId: z.string().optional().describe("Add the item to this collection (an id from list_collections)."),
});

// ── Tools ──────────────────────────────────────────────────────────────────────────────────

/** One line of whitespace-collapsed text, cut to `max` characters. */
function oneLine(value: string, max: number) {
  return truncate(value.replace(/\s+/g, " ").trim(), max);
}

function typeLabel(type: ApiItem["type"]) {
  return type.isSystem ? type.slug : `${type.slug} (custom)`;
}

export async function searchItems(caller: ApiCaller, input: z.output<typeof searchItemsInput>): Promise<ToolResult> {
  return guard("search_items", async () => {
    const limit = Math.min(input.limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
    const { items } = await listApiItems(caller.userId, {
      q: input.query,
      type: input.type || undefined,
      tag: input.tag || undefined,
      limit,
    });
    if (items.length === 0) return text(`No items match "${input.query}".`);

    const lines = items.map((item) => {
      const tags = item.tags.length > 0 ? item.tags.join(", ") : "no tags";
      const head = `${item.id} · ${typeLabel(item.type)} · ${item.title} · ${tags}`;
      const preview = item.content ?? item.url ?? item.file?.name ?? "";
      return preview.trim() ? `${head}\n  ${oneLine(preview, SEARCH_PREVIEW_CHARS)}` : head;
    });
    const more = items.length === limit ? "\n\nMore may match: narrow the query or raise the limit." : "";
    return text(`${items.length} ${items.length === 1 ? "item" : "items"} from the user's Cortex:\n\n${lines.join("\n")}${more}`);
  });
}

/** The fence's info string: the item's language, else a sensible default for its type. */
function fenceInfo(item: ApiItem) {
  const language = item.language?.trim();
  if (language) return language;
  if (!item.type.isSystem || item.type.slug === "note") return "markdown";
  if (item.type.slug === "command") return "bash";
  if (item.type.slug === "prompt") return "text";
  return "";
}

/** One item as Markdown: its fields, then its content fenced (A3's rendering for one item). */
export function renderItemForModel(item: ApiItem): string {
  const lines = [`# ${item.title}`, "", `Type: ${typeLabel(item.type)}`];
  if (item.language?.trim()) lines.push(`Language: ${item.language.trim()}`);
  lines.push(`Tags: ${item.tags.length > 0 ? item.tags.join(", ") : "none"}`);
  if (item.collections.length > 0) lines.push(`Collections: ${item.collections.map((c) => c.name).join(", ")}`);
  if (item.url) lines.push(`URL: <${item.url}>`);
  if (item.file) {
    const name = item.file.name ?? item.title;
    lines.push(`File: ${item.file.size === null ? name : `${name} (${formatFileSize(item.file.size, "en")})`} — the file itself is not available here.`);
  }
  if (item.description?.trim()) lines.push("", item.description.trim());
  if (item.content !== null && item.content !== "") {
    const body = renderItemText(item);
    const fence = fenceFor(body);
    lines.push("", `${fence}${fenceInfo(item)}`, `${body}${fence}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function getItem(caller: ApiCaller, input: z.output<typeof getItemInput>): Promise<ToolResult> {
  return guard("get_item", async () => {
    const item = await getApiItem(caller.userId, input.id);
    if (!item) return toolError(`No item with id "${input.id}". Use search_items to find one.`);
    return text(withWarning(renderItemForModel(item), [item]));
  });
}

export async function listCollections(caller: ApiCaller): Promise<ToolResult> {
  return guard("list_collections", async () => {
    const collections = await listApiCollections(caller.userId);
    if (collections.length === 0) return text("The user has no collections.");
    const lines = collections.map(({ id, name, itemCount, description }) => {
      const count = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
      const first = description?.split("\n").find((line) => line.trim())?.trim();
      return first ? `${id} · ${name} · ${count} · ${first}` : `${id} · ${name} · ${count}`;
    });
    return text(lines.join("\n"));
  });
}

export async function getCollectionContext(
  caller: ApiCaller,
  input: z.output<typeof getCollectionContextInput>,
): Promise<ToolResult> {
  return guard("get_collection_context", async () => {
    const data = await getCollectionContextData(caller.userId, input.id);
    if (!data) return toolError(`No collection with id "${input.id}". Use list_collections to find one.`);
    // The warning counts toward the cap, so the whole answer stays under it.
    const warning = secretWarning(data.items);
    const maxChars = MCP_CONTEXT_MAX_CHARS - (warning ? warning.length + 2 : 0);
    const markdown = renderCollectionContext({ ...data, exportedAt: new Date(), maxChars });
    return text(warning ? `${warning}\n\n${markdown}` : markdown);
  });
}

/** Why the caller cannot write, or null when it can. Checked per tool: reads stay open to every token. */
async function writeRefusal(caller: ApiCaller): Promise<string | null> {
  if (caller.scope !== "write") return "This API token is read-only. Create a read + write token in Cortex to save items.";
  if (!canUseApiWrite({ isPro: caller.isPro })) return "Saving items through the API requires CodStash Pro.";
  const limit = await checkRateLimit("apiWrite", caller.tokenId);
  if (!limit.success) return `Too many writes for this API token. Try again in ${secondsUntil(limit.reset)} seconds.`;
  return null;
}

export async function createItemTool(caller: ApiCaller, input: z.output<typeof createItemInput>): Promise<ToolResult> {
  return guard("create_item", async () => {
    const refusal = await writeRefusal(caller);
    if (refusal) return toolError(refusal);

    const { collectionId, tags, ...fields } = input;
    const result = await createItemFromApi(caller.userId, {
      ...fields,
      tags: tags ?? [],
      collectionIds: collectionId ? [collectionId] : [],
    });
    if (!result.ok) {
      if (result.reason === "unsupported_type") return toolError("File and image items cannot be created here.");
      const details = (await englishIssues(result.issues))
        // The tool takes one `collectionId`; the schema checks a list of them.
        .map(({ path, message }) => (path.startsWith("collectionIds") ? `collectionId: ${message}` : path ? `${path}: ${message}` : message))
        .join("\n");
      return toolError(`The item was not created.\n${details}`);
    }

    const created = `Created ${result.id}: ${input.title.trim()}`;
    const warning = secretWarning([fields]);
    return text(warning ? `${created}\n${warning}` : created);
  });
}

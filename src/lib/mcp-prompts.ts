// The MCP server's prompts (C3): each of the user's prompt items becomes an MCP prompt, its
// `{{variables}}` (B) its arguments. Pure, so the mapping is tested without the transport.

import { slugify } from "@/lib/item-type-ui";
import { fillVariables, parseVariables, variableFields, type FillOptions } from "@/lib/template-vars";
import { shortId } from "@/lib/utils";

/** `prompts/list` holds at most this many: the most recently updated. */
export const MCP_PROMPTS_MAX = 50;

export interface McpPromptRow {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
}

export interface McpPromptEntry {
  name: string;
  title: string;
  description?: string;
  arguments: { name: string; description?: string; required: false }[];
}

/** `review-a-pull-request-ab12cd34`: the slugified title and the id's last 8 characters (A1). */
export function mcpPromptName(row: Pick<McpPromptRow, "id" | "title">): string {
  return `${slugify(row.title) ?? "prompt"}-${shortId(row.id)}`;
}

/** The id suffix a prompt name ends with, or null when the name is not one `mcpPromptName` makes. */
export function mcpPromptIdSuffix(name: string): string | null {
  const suffix = /-([a-z0-9]{8})$/i.exec(name)?.[1];
  return suffix ?? null;
}

/**
 * One entry of `prompts/list`. Every argument is optional: a missing one takes its default, a
 * built-in (`date`, `uuid`) without a default is filled by the server and is no argument.
 */
export function toMcpPromptEntry(row: McpPromptRow): McpPromptEntry {
  const description = row.description?.trim();
  return {
    name: mcpPromptName(row),
    title: row.title,
    ...(description && { description }),
    arguments: variableFields(parseVariables(row.content ?? "")).map((variable) => ({
      name: variable.name,
      ...(variable.default !== undefined && { description: `Default: ${variable.default || "(empty)"}` }),
      required: false as const,
    })),
  };
}

/** `prompts/get`: the prompt's text with its variables filled, as one user message. */
export function renderMcpPrompt(row: McpPromptRow, values: Record<string, string>, options: FillOptions) {
  const description = row.description?.trim();
  return {
    ...(description && { description }),
    messages: [{ role: "user" as const, content: { type: "text" as const, text: fillVariables(row.content ?? "", values, options) } }],
  };
}

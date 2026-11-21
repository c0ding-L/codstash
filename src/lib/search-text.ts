import { markdownToPlainText } from "@/lib/prompt-text";

/** The longest preview the palette receives, so a whole item never travels to the client. */
export const MAX_SEARCH_PREVIEW_CHARS = 150;

/**
 * An item's text as the command palette shows and searches it: one line, cut at
 * the cap. Prompts and notes are Markdown, so their marks are dropped first; code
 * and commands keep theirs and only have their whitespace collapsed.
 */
export function searchPreview(content: string | null, typeSlug: string): string {
  if (!content) return "";

  const text =
    typeSlug === "prompt" || typeSlug === "note"
      ? markdownToPlainText(content)
      : content.replace(/\s+/g, " ").trim();

  return text.length <= MAX_SEARCH_PREVIEW_CHARS ? text : `${text.slice(0, MAX_SEARCH_PREVIEW_CHARS).trimEnd()}…`;
}

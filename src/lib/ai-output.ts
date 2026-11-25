import { ITEM_LIMITS } from "@/lib/item-limits";
import { toTags } from "@/lib/tags";

export const MAX_TAG_SUGGESTIONS = 5;
export const NO_TAG_SUGGESTIONS = "No tag suggestions for this item.";

/**
 * The tags in a model's answer, ready to offer: lowercase, valid as item tags,
 * none the item already has (case-insensitive), at most `MAX_TAG_SUGGESTIONS`
 * and no more than the item has room for. Tolerates code fences, a `Tags:`
 * prefix, quotes, brackets and one tag per line.
 */
export function parseTagSuggestions(answer: string, existing: string[]): string[] {
  const text = answer
    .replace(/```[\w-]*/g, "")
    .trim()
    .replace(/^tags\s*:\s*/i, "")
    .replace(/["'`[\]]/g, "")
    .replace(/[\r\n]+/g, ",");

  const taken = new Set(existing.map((tag) => tag.toLowerCase()));
  const room = Math.max(0, Math.min(MAX_TAG_SUGGESTIONS, ITEM_LIMITS.tags - existing.length));
  const suggestions: string[] = [];
  for (const raw of toTags(text)) {
    // A list marker ("- ", "1. ", "• ") or a hashtag's "#" is not part of the tag.
    const tag = raw.replace(/^(?:[-*•]|\d+[.)])\s+/, "").replace(/^#+/, "").trim().toLowerCase();
    if (!tag || tag.length > ITEM_LIMITS.tag || taken.has(tag)) continue;
    taken.add(tag);
    suggestions.push(tag);
  }
  return suggestions.slice(0, room);
}

export const NO_DESCRIPTION = "Could not write a description for this item.";

/**
 * The description in a model's answer, ready for the form: one paragraph of
 * plain text, at most `ITEM_LIMITS.description` characters. Tolerates code
 * fences, a `Description:` or `Summary:` prefix, wrapping quotes and markdown
 * emphasis. Empty when nothing usable is left.
 */
export function parseDescription(answer: string): string {
  let text = answer
    .replace(/```[\w-]*/g, "")
    .trim()
    .replace(/^(?:description|summary)\s*:\s*/i, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

  // Quotes around the whole answer, not ones inside it.
  const quoted = /^(["'`“‘])(.*)(["'`”’])$/.exec(text);
  if (quoted) text = quoted[2]!.trim();

  if (text.length <= ITEM_LIMITS.description) return text;
  // Cut at the last word that fits, never mid-word.
  const cut = text.slice(0, ITEM_LIMITS.description - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

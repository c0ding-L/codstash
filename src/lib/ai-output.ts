import { ITEM_LIMITS } from "@/lib/item-limits";
import { toTags } from "@/lib/tags";
import { truncate } from "@/lib/utils";

export const MAX_TAG_SUGGESTIONS = 5;

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
    .replace(/^(?:description|summary|résumé)\s*:\s*/iu, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

  // Quotes around the whole answer, not ones inside it.
  const quoted = /^(["'`“‘])(.*)(["'`”’])$/.exec(text);
  if (quoted) text = quoted[2]!.trim();

  return truncate(text, ITEM_LIMITS.description, { at: "word" });
}

export const EXPLANATION_MAX_LENGTH = 4_000;
/** The longest summary forwarded to the drawer: a lead sentence and five bullets, with room. */
export const SUMMARY_MAX_LENGTH = 3_000;
/** A fence around the whole answer: ```` ```markdown ````, ```` ```md ```` or a bare ```` ``` ````, closed on the last line. */
const WRAPPING_FENCE = /^(`{3,})(markdown|md)?[ \t]*(?:\r?\n([\s\S]*?))?\r?\n\1[ \t]*$/i;

/**
 * The explanation in a model's answer, ready to render as Markdown: without a
 * fence wrapping the whole answer (inner code blocks are kept), trimmed and at
 * most `EXPLANATION_MAX_LENGTH` characters. Empty when nothing is left.
 */
export function parseExplanation(answer: string): string {
  let text = answer.trim();
  const fenced = WRAPPING_FENCE.exec(text);
  const inside = fenced?.[3] ?? "";
  // A `markdown` fence always wraps the answer, code blocks inside it included. A bare fence only
  // wraps it when nothing inside opens another block at its level: otherwise it is two code blocks.
  if (fenced && (fenced[2] || !new RegExp(`^${fenced[1]}`, "m").test(inside))) text = inside.trim();

  return truncate(text, EXPLANATION_MAX_LENGTH, { at: "lineOrWord" });
}

const OPENING_MARKDOWN_FENCE = /^(`{3,})(?:markdown|md)[ \t]*\r?\n/i;

/**
 * `parseExplanation` for an answer still streaming: a `markdown` fence that opens the answer and
 * has not closed yet is dropped too, so the text does not show as one code block until the end.
 */
export function parseStreamingExplanation(partial: string): string {
  const text = partial.trimStart();
  const opening = OPENING_MARKDOWN_FENCE.exec(text);
  if (opening && !new RegExp(`^${opening[1]}[ \\t]*$`, "m").test(text.slice(opening[0].length))) {
    return parseExplanation(text.slice(opening[0].length));
  }
  return parseExplanation(text);
}

/** What the model made of a prompt: a rewrite, or nothing worth changing. Null when unusable. */
export type OptimizedPrompt = { changed: true; prompt: string } | { changed: false };

/** A fence around the whole answer, with or without a language, closed on the last line. */
const WRAPPING_ANY_FENCE = /^(`{3,})[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/;
/** A lead-in line such as "Here is the improved prompt:" or "Optimized prompt:". */
const LEAD_IN = /^(?:here(?:'s| is) (?:the |an |your )?)?(?:improved|optimi[sz]ed|refined|rewritten|revised)(?: version of the)? prompt\s*:?[ \t]*\r?\n/i;

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The rewritten prompt in a model's answer, ready to offer: without a lead-in line or a fence
 * wrapping the whole answer, trimmed. `{ changed: false }` when the model answered `NO_CHANGES`
 * or returned the original (whitespace aside). Null when nothing usable is left or the rewrite
 * is over `ITEM_LIMITS.content`: cutting it would save half a prompt.
 */
export function parseOptimizedPrompt(answer: string, original: string): OptimizedPrompt | null {
  let text = answer.trim();
  if (/^[`"'*]*NO_CHANGES[`"'*.]*$/.test(text)) return { changed: false };

  text = text.replace(LEAD_IN, "").trim();
  const fenced = WRAPPING_ANY_FENCE.exec(text);
  // Only when nothing inside opens another block at its level: otherwise it is two code blocks.
  if (fenced && !new RegExp(`^${fenced[1]}`, "m").test(fenced[2]!)) text = fenced[2]!.trim();

  if (!text || text.length > ITEM_LIMITS.content) return null;
  if (collapse(text) === collapse(original)) return { changed: false };
  return { changed: true, prompt: text };
}

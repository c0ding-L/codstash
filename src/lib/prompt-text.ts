/** The longest excerpt the prompt list receives; the 3-line clamp is CSS on top of it. */
export const MAX_EXCERPT_CHARS = 300;

/** Markdown reduced to its text: no headings, emphasis, fences or link targets; whitespace collapsed. */
export function markdownToPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A prompt as the list quotes it: its plain text, cut on a word boundary with an
 * ellipsis when it runs long.
 */
export function promptExcerpt(content: string): string {
  const text = markdownToPlainText(content);
  if (text.length <= MAX_EXCERPT_CHARS) return text;

  const cut = text.slice(0, MAX_EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return `${kept.replace(/[.,;:!?]+$/, "")}…`;
}

/** Words separated by any whitespace. Pass plain text, so Markdown marks are not counted. */
export function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

/** A rough token count, about four characters each: shown with a `~`, never as exact. */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

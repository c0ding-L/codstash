import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Whether a stored URL is safe to use as a link: `url` is free text, and could be `javascript:`. */
export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * A short form of an id for file names and listings: its **last** 8 characters. Ids are
 * `cuid()` v1, which start with a timestamp, so items created together share their first
 * characters; the end is the random part.
 */
export function shortId(id: string) {
  return id.slice(-8);
}

/**
 * `text` cut to at most `max` characters, the ellipsis included, when it is longer. `at` cuts
 * at the last space (`"word"`) or line break or space (`"lineOrWord"`) that fits rather than
 * mid-word; a single word longer than `max` is still cut. `stripPunctuation` drops a trailing
 * `.,;:!?` before the ellipsis.
 */
export function truncate(
  text: string,
  max: number,
  { at, stripPunctuation = false }: { at?: "word" | "lineOrWord"; stripPunctuation?: boolean } = {},
): string {
  if (text.length <= max) return text;
  let kept = text.slice(0, max - 1);
  if (at) {
    const breakAt = at === "word" ? kept.lastIndexOf(" ") : Math.max(kept.lastIndexOf(" "), kept.lastIndexOf("\n"));
    if (breakAt > 0) kept = kept.slice(0, breakAt);
  }
  kept = kept.trimEnd();
  if (stripPunctuation) kept = kept.replace(/[.,;:!?]+$/, "");
  return `${kept}…`;
}

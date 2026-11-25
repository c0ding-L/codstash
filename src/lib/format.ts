import type { Locale } from "@/lib/locale";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** The buckets of a relative time; each has its own message in the `time` namespace. */
export type RelativeTimeUnit = "justNow" | "minutes" | "hours" | "yesterday" | "days" | "weeks" | "months" | "years";

/**
 * Short relative time in the shape the design uses ("2h ago", "Yesterday", "3d ago", "1w ago"),
 * as a unit and a count. The `time` messages word it per language; `Intl.RelativeTimeFormat`
 * renders "2 hours ago", so the bucketing is written out.
 *
 * `now` is required and passed in by the caller rather than read here: the
 * dashboard renders per request (`connection()`), so callers take one `new
 * Date()` per render and every label in it is measured against the same instant.
 */
export function relativeTime(iso: string, now: string): { unit: RelativeTimeUnit; count: number } {
  const elapsed = Date.parse(now) - Date.parse(iso);

  if (elapsed < MINUTE) return { unit: "justNow", count: 0 };
  if (elapsed < HOUR) return { unit: "minutes", count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { unit: "hours", count: Math.floor(elapsed / HOUR) };
  if (elapsed < 2 * DAY) return { unit: "yesterday", count: 1 };
  if (elapsed < WEEK) return { unit: "days", count: Math.floor(elapsed / DAY) };
  if (elapsed < 30 * DAY) return { unit: "weeks", count: Math.floor(elapsed / WEEK) };
  if (elapsed < 365 * DAY) return { unit: "months", count: Math.floor(elapsed / (30 * DAY)) };
  return { unit: "years", count: Math.floor(elapsed / (365 * DAY)) };
}

/** Unit symbols per language: French writes octets ("Ko", "Mo"). */
const FILE_SIZE_UNITS: Record<Locale, [string, string, string]> = {
  en: ["B", "KB", "MB"],
  fr: ["o", "Ko", "Mo"],
};

/** Byte count as a short human label: "2.3 MB" in English, "2,3 Mo" in French. */
export function formatFileSize(bytes: number, locale: Locale = "en") {
  const [b, kb, mb] = FILE_SIZE_UNITS[locale];
  const oneDecimal = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

  if (bytes < 1024) return `${bytes} ${b}`;
  if (bytes < 1024 * 1024) return `${oneDecimal(bytes / 1024)} ${kb}`;
  return `${oneDecimal(bytes / (1024 * 1024))} ${mb}`;
}

/** An item's collections as one line, "React, Hooks"; null when it is in none. */
export function formatCollectionNames(collections: { name: string }[]) {
  return collections.length > 0 ? collections.map(({ name }) => name).join(", ") : null;
}

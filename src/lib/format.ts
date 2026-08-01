import { MOCK_NOW } from "@/lib/mock-data";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Short relative label in the shape the design uses: "2h ago", "Yesterday",
 * "3d ago", "1w ago". `Intl.RelativeTimeFormat` renders "2 hours ago", so the
 * bucketing is written out.
 *
 * Measured against MOCK_NOW rather than the wall clock: `/dashboard` is
 * statically prerendered, so a `new Date()` here would freeze at build time and
 * every label would drift as the build ages.
 */
export function formatRelativeTime(iso: string, now: string = MOCK_NOW) {
  const elapsed = Date.parse(now) - Date.parse(iso);

  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 2 * DAY) return "Yesterday";
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / WEEK)}w ago`;
  if (elapsed < 365 * DAY) return `${Math.floor(elapsed / (30 * DAY))}mo ago`;
  return `${Math.floor(elapsed / (365 * DAY))}y ago`;
}

/** Byte count as a short human label, e.g. "2.3 MB". */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Short relative label in the shape the design uses: "2h ago", "Yesterday",
 * "3d ago", "1w ago". `Intl.RelativeTimeFormat` renders "2 hours ago", so the
 * bucketing is written out.
 *
 * `now` is required and passed in by the caller rather than read here: the
 * dashboard renders per request (`connection()`), so callers take one `new
 * Date()` per render and every label in it is measured against the same instant.
 */
export function formatRelativeTime(iso: string, now: string) {
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

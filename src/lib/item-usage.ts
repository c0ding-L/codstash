/**
 * Tells the server an item was used (A5): copied or opened in the drawer. Fire and forget:
 * `keepalive` lets the request finish when a copy is followed by leaving the page, and a
 * failure is ignored, since "Recently used" is a convenience, never worth an error toast.
 * Client-only.
 */
export function markUsed(itemId: string): void {
  try {
    void fetch(`/api/items/${encodeURIComponent(itemId)}/used`, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // `fetch` itself can throw (an invalid URL in an odd environment): still nothing to report.
  }
}

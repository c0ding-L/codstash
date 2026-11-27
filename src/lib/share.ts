// Public sharing (D1), pure and client-safe: the server actions, the public pages and the
// share dialog use the same id rules and paths.

import { containsSecrets, type ScannableItem } from "@/lib/secrets";

export type ShareKind = "collection" | "item";

/** 16 random bytes in base64url, without padding: 22 characters. */
const SHARE_ID_BYTES = 16;
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** A new random share id. Web Crypto, so it works on the server and in the browser alike. */
export function generateShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Whether a URL segment can be a share id, so a public page answers 404 without a query. */
export function isShareId(value: unknown): value is string {
  return typeof value === "string" && SHARE_ID_PATTERN.test(value);
}

/** The public page's path: `/s/<id>` for a collection, `/s/i/<id>` for an item. */
export function sharePath(kind: ShareKind, shareId: string): string {
  return kind === "item" ? `/s/i/${shareId}` : `/s/${shareId}`;
}

/** The items a public page may show: anything that looks like a secret is left out. */
export function visibleSharedItems<T extends ScannableItem>(items: T[]): T[] {
  return items.filter((item) => !containsSecrets(item));
}

/** How many titles the "holds a secret" refusal lists before "and N more". */
export const SECRET_TITLES_SHOWN = 5;

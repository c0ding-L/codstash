// The item drawer's detail, as the browser reads it from `/api/items/[id]`. Client-safe.

import type { ItemDetailJson } from "@/lib/db/items";

/**
 * One of the user's items in full: what the lists never have, its content above all. Throws
 * when the request fails or is refused, so each caller says so in its own words.
 */
export async function fetchItemDetail(itemId: string, init?: RequestInit): Promise<ItemDetailJson> {
  const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`, init);
  if (!response.ok) throw new Error(`Item request failed with ${response.status}.`);
  return (await response.json()) as ItemDetailJson;
}

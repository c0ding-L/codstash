import { NextResponse } from "next/server";

import { getCollections, type SearchCollection } from "@/lib/db/collections";
import { getSearchItems } from "@/lib/db/items";
import { requireSessionUser } from "@/lib/session-route";

/**
 * Everything the command palette searches, in one response. The palette sits in
 * the layout's top bar, which cannot wait on data, so it fetches this on load
 * and again each time it opens. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET() {
  const caller = await requireSessionUser();
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  const [items, collections] = await Promise.all([
    getSearchItems(userId),
    getCollections(userId),
  ]);

  return NextResponse.json({
    items,
    collections: collections.map(
      ({ id, name, itemCount }): SearchCollection => ({ id, name, itemCount }),
    ),
  });
}

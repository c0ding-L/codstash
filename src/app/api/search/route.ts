import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getCollections, type SearchCollection } from "@/lib/db/collections";
import { getSearchItems } from "@/lib/db/items";

/**
 * Everything the command palette searches, in one response. The palette sits in
 * the layout's top bar, which cannot wait on data, so it fetches this on load
 * and again each time it opens. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [items, collections] = await Promise.all([
    getSearchItems(session.user.id),
    getCollections(session.user.id),
  ]);

  return NextResponse.json({
    items,
    collections: collections.map(
      ({ id, name, itemCount }): SearchCollection => ({ id, name, itemCount }),
    ),
  });
}

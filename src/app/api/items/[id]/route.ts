import { NextResponse } from "next/server";

import { getErrors } from "@/i18n/errors-server";
import { getItemDetail } from "@/lib/db/items";
import { requireSessionUser } from "@/lib/session-route";

/**
 * Full detail for the item drawer. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSessionUser();
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  const item = await getItemDetail(userId, (await params).id);
  if (!item) {
    const e = await getErrors();
    return NextResponse.json({ error: e.message("items.itemNotFound") }, { status: 404 });
  }

  return NextResponse.json(item);
}

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getItemDetail } from "@/lib/db/items";

/**
 * Full detail for the item drawer. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const item = await getItemDetail(session.user.id, (await params).id);
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json(item);
}

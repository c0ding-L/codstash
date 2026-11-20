import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getCollectionOptions } from "@/lib/db/collections";

/**
 * The signed-in user's collections, for the item forms' picker. The forms live
 * in the layout's top bar and the item drawer, which cannot wait on data, so
 * they fetch this when they open. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  return NextResponse.json(await getCollectionOptions(session.user.id));
}

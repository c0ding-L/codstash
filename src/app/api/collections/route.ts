import { NextResponse } from "next/server";

import { getCollectionOptions } from "@/lib/db/collections";
import { requireSessionUser } from "@/lib/session-route";

/**
 * The signed-in user's collections, for the item forms' picker. The forms live
 * in the layout's top bar and the item drawer, which cannot wait on data, so
 * they fetch this when they open. The proxy does not cover this path, so the
 * session is checked here, and a caller gets a 401 rather than a redirect.
 */
export async function GET() {
  const caller = await requireSessionUser();
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  return NextResponse.json(await getCollectionOptions(userId));
}

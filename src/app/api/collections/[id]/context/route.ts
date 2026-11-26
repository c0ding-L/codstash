import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { contextDisposition, renderCollectionContext } from "@/lib/context-export";
import { getCollectionContextData } from "@/lib/db/context-export";
import { checkRateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";

/**
 * One of the signed-in user's collections as a Markdown file for an AI coding assistant.
 * Free and Pro alike: file items list only their names. Outside the proxy's matcher, so
 * the session is checked here.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/collections/[id]/context">) {
  const e = await getErrors();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }
  const userId = session.user.id;

  const limit = await checkRateLimit("contextExport", userId);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const { id } = await ctx.params;
  const data = await getCollectionContextData(userId, id);
  if (!data) {
    return NextResponse.json({ error: e.message("collections.notFound") }, { status: 404 });
  }

  const markdown = renderCollectionContext({ ...data, exportedAt: new Date() });
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": contextDisposition(data.collection.name),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

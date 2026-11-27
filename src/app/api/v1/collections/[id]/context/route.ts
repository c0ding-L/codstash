import { authenticateApi } from "@/lib/api-auth";
import { apiNotFound, apiServerError } from "@/lib/api-v1";
import { renderCollectionContext } from "@/lib/context-export";
import { getCollectionContextData } from "@/lib/db/context-export";

/** One of the user's collections as A3's Markdown context file, for an AI coding assistant. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/collections/[id]/context">) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;

  try {
    const { id } = await ctx.params;
    const data = await getCollectionContextData(caller.userId, id);
    if (!data) return apiNotFound("collection");

    return new Response(renderCollectionContext({ ...data, exportedAt: new Date() }), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiServerError("GET /collections/[id]/context", error);
  }
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { importCandidates } from "@/lib/db/import";
import { IMPORT_BODY_MAX_BYTES, importBatchSchema } from "@/lib/import";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonWithin } from "@/lib/request-body";
import { importLimits } from "@/lib/usage-limits";
import { importBodyError, rateLimitedResponse, requireSessionUser } from "@/lib/session-route";

/** A batch of 100 items in chunks of 50, on a cold database. */
export const maxDuration = 120;

/**
 * One batch of an import: the browser reads the export or the files, maps them with
 * `src/lib/import.ts` and sends up to 100 candidates per request (Vercel caps a body at
 * ~4.5 MB). Every candidate is checked again by `importCandidates`. Outside the proxy's
 * matcher, so the session is checked here.
 */
export async function POST(request: Request) {
  const e = await getErrors();
  const caller = await requireSessionUser();
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  const body = await readJsonWithin(request, IMPORT_BODY_MAX_BYTES);
  if (!body.ok) return importBodyError(e, body.status);
  const batch = importBatchSchema.safeParse(body.json);
  if (!batch.success) {
    return NextResponse.json({ error: e.message("import.badRequest") }, { status: 400 });
  }

  const limit = await checkRateLimit("import", userId);
  if (!limit.success) return await rateLimitedResponse(limit.reset);

  // Read now, not from the session: the token can be a request old.
  const plan = await getPlanStatus(userId);
  const result = await importCandidates(userId, batch.data.candidates, {
    conflict: batch.data.conflict,
    ...importLimits(plan),
    types: batch.data.types,
    collections: batch.data.collections,
  });

  if (result.created > 0 || result.collectionsCreated > 0) revalidatePath("/", "layout");
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

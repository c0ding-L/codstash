import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { importCandidates } from "@/lib/db/import";
import { IMPORT_BODY_MAX_BYTES, importBatchSchema } from "@/lib/import";
import { checkRateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { readJsonWithin } from "@/lib/request-body";
import { FREE_LIMITS, canUseCustomTypes } from "@/lib/usage-limits";

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await readJsonWithin(request, IMPORT_BODY_MAX_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: e.message(body.status === 413 ? "import.tooLarge" : "import.badRequest") },
      { status: body.status },
    );
  }
  const batch = importBatchSchema.safeParse(body.json);
  if (!batch.success) {
    return NextResponse.json({ error: e.message("import.badRequest") }, { status: 400 });
  }

  const limit = await checkRateLimit("import", userId);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  // Read now, not from the session: the token can be a request old.
  const plan = await getPlanStatus(userId);
  const result = await importCandidates(userId, batch.data.candidates, {
    conflict: batch.data.conflict,
    maxItems: plan.isPro ? undefined : FREE_LIMITS.items,
    maxCollections: plan.isPro ? undefined : FREE_LIMITS.collections,
    customTypes: canUseCustomTypes(plan),
    types: batch.data.types,
    collections: batch.data.collections,
  });

  if (result.created > 0 || result.collectionsCreated > 0) revalidatePath("/", "layout");
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

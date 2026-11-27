import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { getGithubAccessToken, importCandidates } from "@/lib/db/import";
import {
  GithubError,
  fetchGist,
  getGithubLogin,
  isGistId,
  isGithubUsername,
  listPublicGists,
} from "@/lib/github-gists";
import {
  MAX_GISTS_PER_IMPORT,
  countRefused,
  emptyImportResult,
  fromGist,
  mergeImportResults,
  type ImportCandidate,
} from "@/lib/import";
import { checkRateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { readJsonWithin } from "@/lib/request-body";
import { FREE_LIMITS, canUseCustomTypes } from "@/lib/usage-limits";

/** Up to 100 gists fetched from GitHub, then written in chunks. */
export const maxDuration = 120;

/** Gists fetched from GitHub at the same time. */
const CONCURRENCY = 5;
/** `{ gistIds, username? }`: a few kilobytes at most. */
const MAX_BODY_BYTES = 16_384;

const importGistsSchema = z.object({
  username: z.string().optional(),
  gistIds: z.array(z.string().refine(isGistId)).min(1).max(MAX_GISTS_PER_IMPORT),
  conflict: z.enum(["skip", "duplicate"]).default("skip"),
});

type Errors = Awaited<ReturnType<typeof getErrors>>;

function githubErrorResponse(e: Errors, error: GithubError) {
  if (error.kind === "rateLimit") return NextResponse.json({ error: e.message("import.githubRateLimit") }, { status: 429 });
  if (error.kind === "notFound") return NextResponse.json({ error: e.message("import.githubNotFound") }, { status: 404 });
  return NextResponse.json({ error: e.message("import.githubFailed") }, { status: 502 });
}

/**
 * Lists the public gists of `?username=`, or of the linked GitHub account when it is left
 * out. `{ username: null, gists: [] }` when there is neither, so the user types one.
 */
export async function GET(request: Request) {
  const e = await getErrors();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }
  const userId = session.user.id;

  const typed = new URL(request.url).searchParams.get("username")?.trim() || null;
  if (typed !== null && !isGithubUsername(typed)) {
    return NextResponse.json({ error: e.message("import.badUsername") }, { status: 400 });
  }

  const limit = await checkRateLimit("import", userId);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const token = await getGithubAccessToken(userId);
  const username = typed ?? (token ? await getGithubLogin(token) : null);
  if (!username) return NextResponse.json({ username: null, gists: [] }, { headers: { "Cache-Control": "no-store" } });

  try {
    const gists = await listPublicGists(username, token);
    return NextResponse.json({ username, gists }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GithubError) return githubErrorResponse(e, error);
    throw error;
  }
}

/**
 * Imports the chosen public gists, one item per file. A gist GitHub no longer serves is
 * counted in `gistsNotFetched`; hitting GitHub's rate limit midway imports what was fetched
 * and says so in `warning`.
 */
export async function POST(request: Request) {
  const e = await getErrors();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await readJsonWithin(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: e.message(body.status === 413 ? "import.tooLarge" : "import.badRequest") },
      { status: body.status },
    );
  }
  const parsed = importGistsSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: e.message("import.badRequest") }, { status: 400 });
  }

  const limit = await checkRateLimit("import", userId);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const token = await getGithubAccessToken(userId);
  const ids = [...new Set(parsed.data.gistIds)];
  const pre = emptyImportResult();
  const candidates: ImportCandidate[] = [];
  let notFetched = 0;
  let attempted = 0;
  let rateLimited = false;

  for (let start = 0; start < ids.length && !rateLimited; start += CONCURRENCY) {
    const slice = ids.slice(start, start + CONCURRENCY);
    attempted += slice.length;
    const fetched = await Promise.allSettled(slice.map((id) => fetchGist(id, token)));
    for (const outcome of fetched) {
      if (outcome.status === "rejected") {
        if (!(outcome.reason instanceof GithubError)) throw outcome.reason;
        if (outcome.reason.kind === "rateLimit") rateLimited = true;
        notFetched += 1;
        continue;
      }
      for (const checked of fromGist(outcome.value)) {
        if (checked.ok) candidates.push(checked.candidate);
        else countRefused(pre, checked);
      }
    }
  }
  // The gists after GitHub's limit was hit were never asked for.
  notFetched += ids.length - attempted;
  if (candidates.length === 0 && rateLimited) {
    return NextResponse.json({ error: e.message("import.githubRateLimit") }, { status: 429 });
  }

  const plan = await getPlanStatus(userId);
  const written =
    candidates.length > 0
      ? await importCandidates(userId, candidates, {
          conflict: parsed.data.conflict,
          maxItems: plan.isPro ? undefined : FREE_LIMITS.items,
          maxCollections: plan.isPro ? undefined : FREE_LIMITS.collections,
          customTypes: canUseCustomTypes(plan),
        })
      : emptyImportResult();
  const result = mergeImportResults(pre, written);

  if (result.created > 0) revalidatePath("/", "layout");
  return NextResponse.json(
    { ...result, gistsNotFetched: notFetched, ...(rateLimited && { warning: e.message("import.githubRateLimit") }) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

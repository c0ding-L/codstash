// What the app's own route handlers share: the session check and their `{ error }` replies.
// Server-only. The REST API (`/api/v1`) uses bearer auth instead, see `src/lib/api-auth.ts`.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getErrors, type Errors } from "@/i18n/errors-server";
import { secondsUntil, tooManyAttemptsMessage } from "@/lib/rate-limit";

/**
 * The signed-in user's id, or the 401 to return. The proxy does not cover `/api`, so every
 * app route checks the session itself and a caller gets a 401 rather than a redirect.
 */
export async function requireSessionUser(): Promise<{ userId: string } | Response> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };
  const e = await getErrors();
  return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
}

/** The 429 an app route answers with once a limit is hit: the same `{ error }` as its other errors. */
export async function rateLimitedResponse(reset: number) {
  return NextResponse.json(
    { error: await tooManyAttemptsMessage(reset) },
    { status: 429, headers: { "Retry-After": String(secondsUntil(reset)) } },
  );
}

/** The two import routes' reply to a body `readJsonWithin` refused. */
export function importBodyError(e: Errors, status: 400 | 413) {
  return NextResponse.json({ error: e.message(status === 413 ? "import.tooLarge" : "import.badRequest") }, { status });
}

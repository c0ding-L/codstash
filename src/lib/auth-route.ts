// What the auth routes (`/api/auth/*`) share: their `{ success: false, error }` replies and the
// JSON body they read. Server-only.

import { NextResponse } from "next/server";

/** An auth route's refusal. `code` lets the client tell one case apart, e.g. `INVALID_TOKEN`. */
export function authFail(error: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

/** The request's JSON body, or the 400 to return when it is not JSON. */
export async function readAuthBody(request: Request): Promise<{ body: unknown } | Response> {
  try {
    return { body: await request.json() };
  } catch {
    return authFail("Request body must be valid JSON.", 400);
  }
}

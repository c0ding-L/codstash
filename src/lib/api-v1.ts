// Responses of the REST API v1 (C2), shared by its route handlers. Errors use C1's shape,
// `{ error: { code, message } }`, and are always in English.

import { getErrors } from "@/i18n/errors-server";
import { apiError } from "@/lib/api-auth";

/** A zod issue, as far as a 422 needs it. */
interface IssueLike {
  path: PropertyKey[];
  message: string;
  maximum?: number | bigint;
  minimum?: number | bigint;
}

/** Every answer is private to the token's owner. */
const NO_STORE = { "Cache-Control": "no-store" };

/** `{ data }`, or `{ data, nextCursor }` for a list. Dates become ISO strings. */
export function apiData(data: unknown, { status = 200, nextCursor }: { status?: number; nextCursor?: string | null } = {}) {
  return Response.json(nextCursor === undefined ? { data } : { data, nextCursor }, { status, headers: NO_STORE });
}

export function apiNotFound(what: "item" | "collection" | "user") {
  const label = what === "item" ? "Item" : what === "collection" ? "Collection" : "User";
  return apiError(404, "not_found", `${label} not found.`);
}

/**
 * Each issue as `{ path, message }`, in English. The item schemas' messages are translation keys,
 * so each is translated; a message that is not a key is English already and kept.
 */
export async function englishIssues(issues: readonly IssueLike[]): Promise<{ path: string; message: string }[]> {
  const e = await getErrors({ locale: "en" });
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: e.isKey(issue.message) ? e.issue(issue) : issue.message,
  }));
}

/**
 * 422 with `details: [{ path, message }]`. The item schemas' messages are translation keys, so
 * each is translated, in English whatever the caller's `Accept-Language`. A message that is not
 * a key (the API's own query checks, zod's defaults) is English already and kept.
 */
export async function apiValidationError(issues: readonly IssueLike[], message = "The request is invalid.") {
  const details = await englishIssues(issues);
  return Response.json({ error: { code: "invalid_request", message, details } }, { status: 422, headers: NO_STORE });
}

/** The request's JSON body, or the 400 to send back when it is not JSON. */
export async function readJsonBody(request: Request): Promise<{ body: unknown } | Response> {
  try {
    return { body: await request.json() };
  } catch {
    return apiError(400, "invalid_json", "The request body must be JSON.");
  }
}

export function apiServerError(context: string, error: unknown) {
  console.error(`[api v1] ${context} failed:`, error);
  return apiError(500, "internal_error", "Something went wrong. Try again.");
}

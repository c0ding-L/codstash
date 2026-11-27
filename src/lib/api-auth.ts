// Bearer authentication for the API (C2) and the MCP server (C3), with a personal API token
// (C1). Server-only. Messages are English: an API has no UI language, so they never follow
// the request's locale or `Accept-Language`.

import { after } from "next/server";

import { hashToken, parseBearer } from "@/lib/api-token";
import { isProActive } from "@/lib/billing-plans";
import { findApiTokenByHash, touchApiToken, type ApiTokenScope } from "@/lib/db/api-tokens";
import { checkRateLimit, secondsUntil } from "@/lib/rate-limit";
import { canUseApiWrite } from "@/lib/usage-limits";

export interface ApiCaller {
  userId: string;
  tokenId: string;
  scope: ApiTokenScope;
}

export type ApiErrorCode =
  | "invalid_token"
  | "insufficient_scope"
  | "pro_required"
  | "rate_limited";

/** Every API error: `{ "error": { "code", "message" } }`. */
export function apiError(status: number, code: ApiErrorCode | (string & {}), message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

/** The same answer for a missing, malformed, unknown, revoked or expired token, so the reason never leaks. */
function invalidToken() {
  return apiError(401, "invalid_token", "The API token is missing, invalid, revoked or expired.", {
    "WWW-Authenticate": "Bearer",
  });
}

function rateLimited(reset: number) {
  return apiError(429, "rate_limited", "Too many requests for this API token. Try again later.", {
    "Retry-After": String(secondsUntil(reset)),
  });
}

/**
 * Checks the request's bearer token for `need`: the caller, or the error `Response` to
 * send back. A write needs a `write` token and an active Pro plan; a write token
 * outlives a Pro lapse but stops writing.
 */
export async function authenticateApi(request: Request, need: ApiTokenScope): Promise<ApiCaller | Response> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return invalidToken();

  const row = await findApiTokenByHash(hashToken(token));
  const now = new Date();
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) return invalidToken();

  // Anything but "write" is read-only: the column is a free string.
  const scope: ApiTokenScope = row.scope === "write" ? "write" : "read";
  if (need === "write") {
    if (scope !== "write") {
      return apiError(403, "insufficient_scope", "This API token is read-only. Create a read + write token to write.");
    }
    if (!canUseApiWrite({ isPro: isProActive(row.user.proUntil, now) })) {
      return apiError(403, "pro_required", "Writing through the API requires CodStash Pro.");
    }
  }

  const limit = await checkRateLimit("api", row.id);
  if (!limit.success) return rateLimited(limit.reset);
  if (need === "write") {
    const writeLimit = await checkRateLimit("apiWrite", row.id);
    if (!writeLimit.success) return rateLimited(writeLimit.reset);
  }

  after(async () => {
    try {
      await touchApiToken(row.id);
    } catch (error) {
      // The token id only: the token itself is never logged.
      console.error(`[api-auth] recording the use of token ${row.id} failed:`, error);
    }
  });

  return { userId: row.userId, tokenId: row.id, scope };
}

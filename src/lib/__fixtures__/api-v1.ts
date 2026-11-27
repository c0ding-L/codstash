import { apiError, type ApiCaller } from "@/lib/api-auth";

/**
 * For the REST API (C2) route tests: what `authenticateApi` resolves to. The route tests mock
 * only `authenticateApi`, so `apiError` and the 401/403 bodies stay the real ones.
 */
export const USER_ID = "user_1";
export const readCaller: ApiCaller = { userId: USER_ID, tokenId: "tok_1", scope: "read", isPro: false };
export const writeCaller: ApiCaller = { userId: USER_ID, tokenId: "tok_1", scope: "write", isPro: true };

export const invalidToken = () => apiError(401, "invalid_token", "The API token is missing, invalid, revoked or expired.");
export const readOnly = () =>
  apiError(403, "insufficient_scope", "This API token is read-only. Create a read + write token to write.");
export const proRequired = () => apiError(403, "pro_required", "Writing through the API requires CodStash Pro.");

/** A request to the API with a bearer token; a body is sent as JSON. */
export function apiRequest(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    method,
    headers: { authorization: "Bearer cstash_test", "accept-language": "fr" },
    ...(body !== undefined && { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

/** The route context of a dynamic segment. */
export const params = (id: string) => ({ params: Promise.resolve({ id }) });

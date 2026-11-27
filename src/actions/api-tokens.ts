"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { generateToken } from "@/lib/api-token";
import { apiTokenSchema, expiryDate, type ApiTokenInput } from "@/lib/api-token-schema";
import {
  MAX_API_TOKENS,
  createApiTokenRow,
  revokeApiTokenRow,
  type ApiTokenSummary,
} from "@/lib/db/api-tokens";
import { getPlanStatus } from "@/lib/db/billing";
import { LimitReachedError, canUseApiWrite } from "@/lib/usage-limits";

export type CreateApiTokenResult =
  /** `token` is shown once and never stored: the only time it leaves the server. */
  | { success: true; data: { token: string; summary: ApiTokenSummary }; error: null }
  | { success: false; data: null; error: string; field?: "name" | "scope" | "expiry" };

export type RevokeApiTokenResult = { success: true; data: null; error: null } | { success: false; data: null; error: string };

/** Creates a personal API token. Read for everyone; the `write` scope is Pro. At most `MAX_API_TOKENS` active. */
export async function createApiToken(input: ApiTokenInput): Promise<CreateApiTokenResult> {
  const e = await getErrors();
  const parsed = apiTokenSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: e.issue(issue),
      ...((field === "name" || field === "scope" || field === "expiry") && { field }),
    };
  }
  const { name, scope, expiry } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };
    const userId = session.user.id;

    // Read now rather than from the session: the token can be a request old.
    if (scope === "write" && !canUseApiWrite(await getPlanStatus(userId))) {
      return { success: false, data: null, error: e.message("limits.apiWrite"), field: "scope" };
    }

    const { token, prefix, hash } = generateToken();
    const summary = await createApiTokenRow(userId, { name, prefix, hash, scope, expiresAt: expiryDate(expiry) });
    revalidatePath("/settings");
    return { success: true, data: { token, summary }, error: null };
  } catch (error) {
    if (error instanceof LimitReachedError) {
      return { success: false, data: null, error: e.message("apiTokens.tooMany", { max: MAX_API_TOKENS }) };
    }
    // Never the input or the row: the token must not reach the logs.
    console.error("[api-tokens] create failed:", error instanceof Error ? error.message : error);
    return { success: false, data: null, error: e.message("apiTokens.createFailed") };
  }
}

/** Revokes one of the user's tokens. Another user's, a missing or an already revoked one is "not found". */
export async function revokeApiToken(id: string): Promise<RevokeApiTokenResult> {
  const e = await getErrors();
  if (typeof id !== "string" || !id) return { success: false, data: null, error: e.message("apiTokens.notFound") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    if (!(await revokeApiTokenRow(session.user.id, id))) {
      return { success: false, data: null, error: e.message("apiTokens.notFound") };
    }
  } catch (error) {
    console.error(`[api-tokens] revoke of ${id} failed:`, error);
    return { success: false, data: null, error: e.message("apiTokens.revokeFailed") };
  }

  revalidatePath("/settings");
  return { success: true, data: null, error: null };
}

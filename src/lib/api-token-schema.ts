import { z } from "zod";

import { errKey } from "@/i18n/error-keys";

// What Settings › API tokens sends to `createApiToken`. Client-safe: the dialog shares the
// options and the name limit.

export const API_TOKEN_NAME_MAX = 50;

export const API_TOKEN_SCOPES = ["read", "write"] as const;

export const API_TOKEN_EXPIRIES = ["30d", "90d", "1y", "never"] as const;
export type ApiTokenExpiry = (typeof API_TOKEN_EXPIRIES)[number];
export const DEFAULT_API_TOKEN_EXPIRY: ApiTokenExpiry = "90d";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS: Record<Exclude<ApiTokenExpiry, "never">, number> = { "30d": 30, "90d": 90, "1y": 365 };

/** When a token created at `now` with this choice expires, or null for never. */
export function expiryDate(expiry: ApiTokenExpiry, now = new Date()): Date | null {
  return expiry === "never" ? null : new Date(now.getTime() + EXPIRY_DAYS[expiry] * DAY_MS);
}

export const apiTokenSchema = z.object({
  name: z
    .string({ error: errKey("apiTokens.nameRequired") })
    .trim()
    .min(1, errKey("apiTokens.nameRequired"))
    .max(API_TOKEN_NAME_MAX, errKey("apiTokens.nameTooLong")),
  scope: z.enum(API_TOKEN_SCOPES, { error: errKey("apiTokens.invalidScope") }),
  expiry: z.enum(API_TOKEN_EXPIRIES, { error: errKey("apiTokens.invalidExpiry") }),
});

export type ApiTokenInput = z.input<typeof apiTokenSchema>;

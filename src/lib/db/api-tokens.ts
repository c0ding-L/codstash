import type { Role } from "@/lib/billing-plans";
import { assertBelowCap } from "@/lib/db/user-lock";
import { prisma } from "@/lib/prisma";

export const MAX_API_TOKENS = 10;

export type ApiTokenScope = "read" | "write";

/** A token as Settings lists it. The hash never leaves the server. */
export interface ApiTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  /** Past `expiresAt`: listed so the user sees why it stopped, but out of the cap. */
  expired: boolean;
}

export interface NewApiTokenData {
  name: string;
  prefix: string;
  hash: string;
  scope: ApiTokenScope;
  expiresAt: Date | null;
}

/** What a bearer request is checked against. */
export interface ApiTokenLookup {
  id: string;
  userId: string;
  scope: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  user: { proUntil: Date | null; role: Role };
}

/** Not revoked and not expired: what counts towards the cap. */
function activeWhere(userId: string, now: Date) {
  return { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

function toScope(scope: string): ApiTokenScope {
  return scope === "write" ? "write" : "read";
}

const SUMMARY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  scope: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
} as const;

function toSummary(
  token: { scope: string; expiresAt: Date | null } & Omit<ApiTokenSummary, "scope" | "expired">,
  now: Date,
): ApiTokenSummary {
  return { ...token, scope: toScope(token.scope), expired: token.expiresAt !== null && token.expiresAt <= now };
}

/** The user's tokens not revoked, newest first. Expired ones are included and flagged. */
export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const tokens = await prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    select: SUMMARY_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const now = new Date();
  return tokens.map((token) => toSummary(token, now));
}

/**
 * Creates a token, at most `MAX_API_TOKENS` active per user. Same lock as
 * `createCustomType`: the user row is locked, so two concurrent creates queue up
 * and the second re-counts after the first committed.
 */
export async function createApiTokenRow(userId: string, data: NewApiTokenData): Promise<ApiTokenSummary> {
  return prisma.$transaction(async (tx) => {
    await assertBelowCap(tx, userId, "apiTokens", MAX_API_TOKENS, () =>
      tx.apiToken.count({ where: activeWhere(userId, new Date()) }),
    );
    const token = await tx.apiToken.create({
      data: { ...data, user: { connect: { id: userId } } },
      select: SUMMARY_SELECT,
    });
    return toSummary(token, new Date());
  });
}

/** Revokes one of the user's tokens. False when it is missing, already revoked or another user's. */
export async function revokeApiTokenRow(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}

/**
 * Revokes every active token of the user. Not awaited: a query for the caller's
 * `$transaction`, so a password change or reset and the revocation commit together.
 */
export function revokeAllApiTokensQuery(userId: string) {
  return prisma.apiToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** The token with this hash and its owner's Pro date and role, or null. Revoked and expired ones included: the caller decides. */
export async function findApiTokenByHash(hash: string): Promise<ApiTokenLookup | null> {
  return prisma.apiToken.findUnique({
    where: { hash },
    select: {
      id: true,
      userId: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { proUntil: true, role: true } },
    },
  });
}

/**
 * Records a use of the token. Raw SQL so the throttle sits in the query: at most
 * one write a minute per token, with no read first. False when throttled.
 */
export async function touchApiToken(id: string): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "ApiToken" SET "lastUsedAt" = now()
    WHERE "id" = ${id}
      AND ("lastUsedAt" IS NULL OR "lastUsedAt" < now() - interval '1 minute')
  `;
  return updated > 0;
}

// The per-user lock every capped create takes. Server-only. Kept out of `db/billing.ts`, which
// many tests mock whole, so the modules that cap a count can use it without the plan reads.

import type { Prisma } from "@/generated/prisma/client";
import { LimitReachedError } from "@/lib/usage-limits";

/**
 * Locks the user row until the transaction ends, so concurrent creates of the same user queue
 * up and each re-counts after the previous one committed.
 */
export async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

/** Locks the user row, then throws `LimitReachedError(limit)` once `count` reaches `max`. */
export async function assertBelowCap(
  tx: Prisma.TransactionClient,
  userId: string,
  limit: LimitReachedError["limit"],
  max: number,
  count: () => Promise<number>,
): Promise<void> {
  await lockUser(tx, userId);
  if ((await count()) >= max) throw new LimitReachedError(limit);
}

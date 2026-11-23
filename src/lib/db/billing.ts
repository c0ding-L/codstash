import { randomUUID } from "node:crypto";

import { BILLING_PLANS, extendProUntil, isProActive, type Currency, type Plan } from "@/lib/billing-plans";
import { prisma } from "@/lib/prisma";

// `Plan` and `Currency` are the same string unions as Prisma's `BillingPlan`
// and `Currency` enums; the client-safe ones are used so callers need not
// import the generated client.

export interface PlanStatus {
  proUntil: Date | null;
  isPro: boolean;
  items: number;
  collections: number;
}

/** `isPro` here is `isProActive(proUntil)`, never the stored mirror column. */
export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const [user, items, collections] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { proUntil: true } }),
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
  ]);
  const proUntil = user?.proUntil ?? null;
  return { proUntil, isPro: isProActive(proUntil), items, collections };
}

/**
 * `charge` is what Bictorys will charge (`chargeFor`: the table's price, or its
 * XOF conversion), never a client value. The webhook is checked against it.
 * The reference is the `paymentReference` sent to Bictorys.
 */
export function createPendingPayment(userId: string, plan: Plan, charge: { amount: number; currency: Currency }) {
  return prisma.payment.create({
    data: {
      reference: `cortex_${randomUUID().replace(/-/g, "")}`,
      userId,
      plan,
      currency: charge.currency,
      amount: charge.amount,
    },
  });
}

/**
 * Stores the hosted checkout's chargeId, only while nothing else is stored: a
 * webhook that got there first has written the real transaction id.
 */
export function setPaymentTransactionId(paymentId: string, transactionId: string) {
  return prisma.payment.updateMany({ where: { id: paymentId, transactionId: null }, data: { transactionId } });
}

export function findPaymentByReference(reference: string) {
  return prisma.payment.findUnique({ where: { reference } });
}

export type MarkSucceededResult = { applied: false } | { applied: true; proUntil: Date | null };

/**
 * Rows a "paid" report can still settle. FAILED is included because one Bictorys
 * checkout link can be paid more than once (sandbox-verified): a declined card
 * followed by a good one on the same page must still grant Pro.
 */
export const SETTLEABLE_STATUSES = ["PENDING", "FAILED"] as const;

interface MarkOptions {
  /** The Bictorys transaction id from the webhook; replaces the checkout's `chargeId`. */
  transactionId?: string;
  now?: Date;
}

/**
 * Idempotent: only a PENDING or FAILED row moves to SUCCEEDED, so a retried
 * webhook (or the webhook racing the status fallback) extends Pro once.
 *
 * `proUntil` is read under `FOR UPDATE`, so two different payments of the same
 * user settling at once queue up and stack, instead of both extending the same
 * old date.
 */
export async function markPaymentSucceeded(
  reference: string,
  { transactionId, now = new Date() }: MarkOptions = {},
): Promise<MarkSucceededResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { reference } });
    if (!payment || !isSettleable(payment.status)) return { applied: false };

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: [...SETTLEABLE_STATUSES] } },
      data: { status: "SUCCEEDED", paidAt: now, ...(transactionId && { transactionId }) },
    });
    if (claimed.count === 0) return { applied: false };

    const [user] = payment.userId
      ? await tx.$queryRaw<{ proUntil: Date | null }[]>`
          SELECT "proUntil" FROM "User" WHERE "id" = ${payment.userId} FOR UPDATE`
      : [];
    // Account deleted since checkout: the payment is recorded, there is no one to upgrade.
    if (!payment.userId || !user) return { applied: true, proUntil: null };

    const proUntil = extendProUntil(user.proUntil, BILLING_PLANS[payment.plan].days, now);
    await tx.user.update({ where: { id: payment.userId }, data: { proUntil, isPro: true } });
    return { applied: true, proUntil };
  });
}

export function isSettleable(status: string) {
  return (SETTLEABLE_STATUSES as readonly string[]).includes(status);
}

/** Only a PENDING row can fail; a late "failed" never undoes a success. */
export function markPaymentFailed(reference: string, transactionId?: string) {
  return prisma.payment.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "FAILED", ...(transactionId && { transactionId }) },
  });
}

/** Paid at Bictorys, but the amount or currency did not match; fixed by hand. */
export function markPaymentNeedsReview(reference: string, transactionId?: string) {
  return prisma.payment.updateMany({
    where: { reference, status: { in: [...SETTLEABLE_STATUSES] } },
    data: { status: "NEEDS_REVIEW", ...(transactionId && { transactionId }) },
  });
}

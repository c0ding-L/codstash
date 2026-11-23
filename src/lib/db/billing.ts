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
 * The amount always comes from `BILLING_PLANS`, never from the client. The
 * reference is the `paymentReference` sent to Bictorys.
 */
export function createPendingPayment(userId: string, plan: Plan, currency: Currency) {
  return prisma.payment.create({
    data: {
      reference: `cortex_${randomUUID().replace(/-/g, "")}`,
      userId,
      plan,
      currency,
      amount: BILLING_PLANS[plan].price[currency],
    },
  });
}

export function setPaymentTransactionId(paymentId: string, transactionId: string) {
  return prisma.payment.update({ where: { id: paymentId }, data: { transactionId } });
}

export function findPaymentByReference(reference: string) {
  return prisma.payment.findUnique({ where: { reference } });
}

export type MarkSucceededResult = { applied: false } | { applied: true; proUntil: Date | null };

/**
 * Idempotent: only a PENDING row moves to SUCCEEDED, so a retried webhook (or
 * the webhook racing the status fallback) extends Pro once.
 *
 * `proUntil` is read under `FOR UPDATE`, so two different payments of the same
 * user settling at once queue up and stack, instead of both extending the same
 * old date.
 */
export async function markPaymentSucceeded(reference: string, now = new Date()): Promise<MarkSucceededResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { reference } });
    if (!payment || payment.status !== "PENDING") return { applied: false };

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCEEDED", paidAt: now },
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

/** Only a PENDING row can fail; a late "failed" never undoes a success. */
export function markPaymentFailed(reference: string) {
  return prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Paid at Bictorys, but the amount or currency did not match; fixed by hand. */
export function markPaymentNeedsReview(reference: string) {
  return prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "NEEDS_REVIEW" } });
}

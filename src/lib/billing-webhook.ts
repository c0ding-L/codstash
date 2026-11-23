import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  findPaymentByReference,
  isSettleable,
  markPaymentFailed,
  markPaymentNeedsReview,
  markPaymentSucceeded,
} from "@/lib/db/billing";

// Server-only: uses `node:crypto` and the DB. Never import it from a client
// component. Payload facts below come from real sandbox webhooks
// (`src/lib/__fixtures__/bictorys/`, plan §10).

export const PAID_STATUSES = new Set(["succeeded", "authorized"]);
export const FAILED_STATUSES = new Set(["failed", "cancelled"]);
/** Not settled yet: no change, nothing to log. */
const WAITING_STATUSES = new Set(["pending", "processing"]);

const MAX_SKEW_MS = 5 * 60 * 1000;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Accepts a timestamp in seconds or in milliseconds; `null` when it is not a number. */
function timestampMs(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}

/**
 * `X-Secret-Key` is required. The sandbox sends only that (plus
 * `X-Webhook-Version`); the HMAC headers appear in one Bictorys guide, so they
 * are checked when both are present and never required.
 */
export function verifyWebhook(headers: Headers, rawBody: string, secret: string, now = Date.now()) {
  if (!secret) return false;
  const key = headers.get("x-secret-key");
  if (!key || !safeEqual(key, secret)) return false;

  const signature = headers.get("x-webhook-signature");
  const timestamp = headers.get("x-webhook-timestamp");
  if (signature && timestamp) {
    const sentAt = timestampMs(timestamp);
    if (sentAt === null || Math.abs(now - sentAt) > MAX_SKEW_MS) return false;
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    if (!safeEqual(signature, expected)) return false;
  }
  return true;
}

/**
 * Only the fields Cortex reads; the rest pass through (Bictorys adds fields
 * without notice). `amount` arrives as `4000.0`; the Mobile Money guide types
 * it as a string, so both are accepted.
 */
export const webhookPayloadSchema = z.looseObject({
  paymentReference: z.string().min(1),
  status: z.string().min(1),
  amount: z.union([z.number(), z.string().min(1)]).transform(Number).pipe(z.number().finite()),
  currency: z.string().min(1),
  id: z.string().min(1).nullish(),
});

export interface ReportedPayment {
  status: string;
  /** Absent from the status endpoint, which returns only `{ id, status }`. */
  amount?: number;
  currency?: string;
  /** The Bictorys transaction id (the webhook `id`), not the checkout's `chargeId`. */
  transactionId?: string;
}

/**
 * `amount` is exactly what was charged: fees are reported apart (`merchantFees`,
 * `customerFees`), and the converted pair is `settledAmount` / `settledCurrency`,
 * which is never compared.
 */
export function amountMatches(reported: number, charged: number) {
  return reported === charged;
}

/**
 * The single confirm path. Idempotent: a retried webhook changes nothing.
 * Returns the payment's status afterwards, or `null` for an unknown reference.
 */
export async function applyPaymentStatus(reference: string, reported: ReportedPayment) {
  const payment = await findPaymentByReference(reference);
  if (!payment) return null;

  const status = reported.status.toLowerCase();
  const { transactionId } = reported;

  if (PAID_STATUSES.has(status)) {
    if (!isSettleable(payment.status)) {
      // One checkout link can be paid more than once. The same id is a retry;
      // another id is a second real payment, refunded by hand.
      if (transactionId && transactionId !== payment.transactionId) {
        console.error("[billing] second payment on a settled checkout, refund by hand", {
          reference,
          storedStatus: payment.status,
          storedTransactionId: payment.transactionId,
          ...reported,
        });
      }
      return payment.status;
    }

    const mismatch =
      (reported.currency !== undefined && reported.currency !== payment.currency) ||
      (reported.amount !== undefined && !amountMatches(reported.amount, payment.amount));
    if (mismatch) {
      // Paid at Bictorys but not what was charged: never grant, never drop.
      await markPaymentNeedsReview(reference, transactionId);
      console.error("[billing] payment needs review", {
        reference,
        expected: { amount: payment.amount, currency: payment.currency },
        ...reported,
      });
      return "NEEDS_REVIEW";
    }

    const result = await markPaymentSucceeded(reference, { transactionId });
    return result.applied ? "SUCCEEDED" : payment.status;
  }

  if (FAILED_STATUSES.has(status)) {
    if (payment.status !== "PENDING") return payment.status;
    await markPaymentFailed(reference, transactionId);
    return "FAILED";
  }

  if (status === "reversed") {
    // Refunds are handled by hand for now (plan §10 q7); Pro time is not removed.
    console.error("[billing] payment reversed, handle by hand", { reference, ...reported });
  } else if (!WAITING_STATUSES.has(status)) {
    // A status Cortex does not know (the docs also show "success"): never dropped silently.
    console.error("[billing] unknown payment status, left unchanged", { reference, ...reported });
  }
  // pending / processing / reversed / anything new: no change.
  return payment.status;
}

/**
 * The webhook, minus the HTTP plumbing. A thrown DB error propagates, so the
 * route answers 500 and Bictorys retries.
 */
export async function handleBictorysWebhook(headers: Headers, rawBody: string): Promise<{ status: number }> {
  if (!verifyWebhook(headers, rawBody, process.env.BICTORYS_WEBHOOK_SECRET ?? "")) return { status: 401 };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400 };
  }

  const parsed = webhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    // Not a payment event Cortex knows: acknowledged, so Bictorys stops retrying.
    console.warn("[billing] webhook ignored, unrecognised payload", z.flattenError(parsed.error).fieldErrors);
    return { status: 200 };
  }

  const { paymentReference, status, amount, currency, id } = parsed.data;
  const result = await applyPaymentStatus(paymentReference, {
    status,
    amount,
    currency,
    transactionId: id ?? undefined,
  });
  if (result === null) console.warn("[billing] webhook for an unknown payment reference", { paymentReference, status });
  return { status: 200 };
}

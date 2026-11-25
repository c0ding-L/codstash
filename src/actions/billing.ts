"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { createCharge } from "@/lib/bictorys";
import { BILLING_PLANS, CURRENCIES, PLANS } from "@/lib/billing-plans";
import {
  createPendingPayment,
  findPaymentByReference,
  markPaymentFailed,
  setPaymentTransactionId,
} from "@/lib/db/billing";
import { getProfile } from "@/lib/db/profile";
import { chargeFor } from "@/lib/exchange-rates";
import { checkRateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";

export type CheckoutResult =
  | { success: true; redirectUrl: string; error: null }
  | { success: false; redirectUrl: null; error: string };

const checkoutSchema = z.object({
  plan: z.enum(PLANS, { error: errKey("billing.choosePlan") }),
  currency: z.enum(CURRENCIES, { error: errKey("billing.chooseCurrency") }),
});

const failure = (error: string): CheckoutResult => ({ success: false, redirectUrl: null, error });

/** Shows only the card tab of the hosted checkout (`payment_category=card`, Bictorys docs). */
function cardOnly(link: string) {
  const url = new URL(link);
  url.searchParams.set("payment_category", "card");
  return url.toString();
}

/**
 * Creates a PENDING payment and its Bictorys hosted checkout. The client then
 * goes to `redirectUrl` with `window.location.assign`. The amount always comes
 * from `BILLING_PLANS` (EUR/USD converted to XOF, see `chargeFor`); anything
 * else in the input is ignored.
 */
export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const e = await getErrors();
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));
  const { plan, currency } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const limit = await checkRateLimit("checkout", session.user.id);
    if (!limit.success) return failure(await tooManyAttemptsMessage(limit.reset));

    const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
    if (!appUrl) {
      console.error("[billing] APP_URL is not set.");
      return failure(e.message("billing.checkoutFailed"));
    }

    const user = await getProfile(session.user.id);
    if (!user) return failure(e.message("billing.accountGone"));

    let charge: Awaited<ReturnType<typeof chargeFor>>;
    try {
      charge = await chargeFor(plan, currency);
    } catch (error) {
      console.error("[billing] could not price the charge:", error);
      return failure(e.message("billing.currencyUnavailable", { currency }));
    }

    const payment = await createPendingPayment(user.id, plan, charge);
    const back = `${appUrl}/settings/billing?ref=${encodeURIComponent(payment.reference)}`;
    let created: Awaited<ReturnType<typeof createCharge>>;
    try {
      created = await createCharge({
        amount: payment.amount,
        currency: charge.currency,
        reference: payment.reference,
        merchantReference: user.id,
        label: BILLING_PLANS[plan].label,
        successUrl: back,
        errorUrl: `${back}&error=1`,
        customer: { name: user.name, email: user.email },
      });
    } catch (error) {
      // No checkout exists for this row, so it can never be paid: close it.
      await markPaymentFailed(payment.reference).catch(() => {});
      throw error;
    }
    // The hosted checkout's chargeId, kept for tracing; the webhook replaces it
    // with the real transaction id.
    if (created.transactionId) await setPaymentTransactionId(payment.id, created.transactionId);

    return { success: true, redirectUrl: charge.cardOnly ? cardOnly(created.redirectUrl) : created.redirectUrl, error: null };
  } catch (error) {
    console.error("[billing] startCheckout failed:", error);
    return failure(e.message("billing.checkoutFailed"));
  }
}

export type PaymentStatusResult = { status: "PENDING" | "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" } | { status: null };

/**
 * The return page's poll: the status of the signed-in user's own payment.
 * Display only, and read from the DB alone. Asking Bictorys would not help:
 * until the webhook stores the transaction id, only the checkout's chargeId is
 * known, which the status endpoint answers with "pending"; once it is stored,
 * the webhook has already settled the row (plan §10 q4, q5).
 */
export async function refreshPaymentStatus(reference: unknown): Promise<PaymentStatusResult> {
  if (typeof reference !== "string" || !reference) return { status: null };

  const session = await auth();
  if (!session?.user?.id) return { status: null };

  const payment = await findPaymentByReference(reference);
  if (!payment || payment.userId !== session.user.id) return { status: null };
  return { status: payment.status };
}

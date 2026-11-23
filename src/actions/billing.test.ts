import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { refreshPaymentStatus, startCheckout } from "@/actions/billing";
import { auth } from "@/auth";
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
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/bictorys", () => ({ createCharge: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({
  createPendingPayment: vi.fn(),
  findPaymentByReference: vi.fn(),
  markPaymentFailed: vi.fn(),
  setPaymentTransactionId: vi.fn(),
}));
vi.mock("@/lib/db/profile", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/exchange-rates", () => ({ chargeFor: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  tooManyAttemptsMessage: vi.fn(() => "Too many attempts. Try again in 5 minutes."),
}));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const charge = asMock(createCharge);
const createPayment = asMock(createPendingPayment);
const findPayment = asMock(findPaymentByReference);
const setTransactionId = asMock(setPaymentTransactionId);
const markFailed = asMock(markPaymentFailed);
const profile = asMock(getProfile);
const rateLimit = asMock(checkRateLimit);
const price = asMock(chargeFor);

const USER_ID = "user_1";
const APP_URL = "https://cortex.example";
const REFERENCE = "cortex_abc";
const CHECKOUT_LINK = "https://pay.test.bictorys.com/payment/v1/checkout?charge_id=ch_1";

beforeEach(() => {
  vi.stubEnv("APP_URL", `${APP_URL}/`);
  session.mockResolvedValue({ user: { id: USER_ID } });
  rateLimit.mockResolvedValue({ success: true, reset: 0 });
  profile.mockResolvedValue({ id: USER_ID, name: "Ada", email: "ada@example.com" });
  // XOF as priced; EUR/USD converted to XOF, card only (the real chargeFor reads the table).
  price.mockImplementation(async (plan: keyof typeof BILLING_PLANS, currency: "USD" | "EUR" | "XOF") =>
    currency === "XOF"
      ? { amount: BILLING_PLANS[plan].price.XOF, currency: "XOF", cardOnly: false }
      : { amount: plan === "MONTHLY" ? 4_592 : 41_325, currency: "XOF", cardOnly: true },
  );
  createPayment.mockImplementation(
    async (userId: string, plan: string, charge: { amount: number; currency: string }) => ({
      id: "pay_1",
      reference: REFERENCE,
      userId,
      plan,
      ...charge,
    }),
  );
  charge.mockResolvedValue({ transactionId: "ch_1", redirectUrl: CHECKOUT_LINK });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("startCheckout", () => {
  it("creates the payment and the charge, and returns the checkout link", async () => {
    const result = await startCheckout({ plan: "MONTHLY", currency: "XOF" });

    expect(result).toEqual({ success: true, redirectUrl: CHECKOUT_LINK, error: null });
    expect(createPayment).toHaveBeenCalledWith(USER_ID, "MONTHLY", { amount: 4000, currency: "XOF", cardOnly: false });
    const back = `${APP_URL}/settings/billing?ref=${REFERENCE}`;
    expect(charge).toHaveBeenCalledWith({
      amount: 4000,
      currency: "XOF",
      reference: REFERENCE,
      merchantReference: USER_ID,
      label: BILLING_PLANS.MONTHLY.label,
      successUrl: back,
      errorUrl: `${back}&error=1`,
      customer: { name: "Ada", email: "ada@example.com" },
    });
    expect(setTransactionId).toHaveBeenCalledWith("pay_1", "ch_1");
  });

  it("charges what chargeFor prices, for every plan and currency", async () => {
    for (const plan of PLANS) {
      for (const currency of CURRENCIES) {
        charge.mockClear();
        price.mockClear();
        await startCheckout({ plan, currency });
        expect(price).toHaveBeenCalledWith(plan, currency);
        const expected = await price.mock.results[0]!.value;
        expect(charge.mock.calls[0]![0]).toMatchObject({ amount: expected.amount, currency: expected.currency });
      }
    }
  });

  it("charges EUR in XOF and opens the card tab only", async () => {
    const result = await startCheckout({ plan: "MONTHLY", currency: "EUR" });

    expect(charge.mock.calls[0]![0]).toMatchObject({ amount: 4_592, currency: "XOF" });
    expect(result).toMatchObject({ success: true, redirectUrl: `${CHECKOUT_LINK}&payment_category=card` });
  });

  it("refuses USD when the exchange rate cannot be read, before creating anything", async () => {
    price.mockRejectedValue(new Error("network down"));

    expect(await startCheckout({ plan: "MONTHLY", currency: "USD" })).toEqual({
      success: false,
      redirectUrl: null,
      error: "USD payments are unavailable right now. Try another currency.",
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("ignores an amount sent by the client", async () => {
    await startCheckout({ plan: "YEARLY", currency: "XOF", amount: 1 });

    expect(charge.mock.calls[0]![0].amount).toBe(36_000);
  });

  it("refuses an invalid plan or currency", async () => {
    expect(await startCheckout({ plan: "WEEKLY", currency: "USD" })).toEqual({
      success: false,
      redirectUrl: null,
      error: "Choose a plan.",
    });
    expect(await startCheckout({ plan: "MONTHLY", currency: "GBP" })).toEqual({
      success: false,
      redirectUrl: null,
      error: "Choose a currency.",
    });
    expect(await startCheckout(null)).toMatchObject({ success: false });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("refuses a signed-out user", async () => {
    session.mockResolvedValue(null);

    expect(await startCheckout({ plan: "MONTHLY", currency: "USD" })).toEqual({
      success: false,
      redirectUrl: null,
      error: "You are not signed in.",
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("refuses when rate limited", async () => {
    rateLimit.mockResolvedValue({ success: false, reset: Date.now() + 300_000 });

    const result = await startCheckout({ plan: "MONTHLY", currency: "USD" });

    expect(result).toEqual({ success: false, redirectUrl: null, error: "Too many attempts. Try again in 5 minutes." });
    expect(rateLimit).toHaveBeenCalledWith("checkout", USER_ID);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("fails without APP_URL, before creating anything", async () => {
    vi.stubEnv("APP_URL", "");

    expect(await startCheckout({ plan: "MONTHLY", currency: "USD" })).toMatchObject({
      success: false,
      error: "Could not start the payment. Try again.",
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("refuses a deleted account", async () => {
    profile.mockResolvedValue(null);

    expect(await startCheckout({ plan: "MONTHLY", currency: "USD" })).toMatchObject({
      success: false,
      error: "This account no longer exists.",
    });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("returns a friendly message when Bictorys fails", async () => {
    charge.mockRejectedValue(new Error("Bictorys charge failed: 422 <html>…"));

    expect(await startCheckout({ plan: "MONTHLY", currency: "XOF" })).toEqual({
      success: false,
      redirectUrl: null,
      error: "Could not start the payment. Try again.",
    });
    expect(setTransactionId).not.toHaveBeenCalled();
    // The row has no checkout behind it, so it is closed rather than left PENDING.
    expect(markFailed).toHaveBeenCalledWith(REFERENCE);
  });

  it("still answers with the friendly message when closing the row fails too", async () => {
    charge.mockRejectedValue(new Error("Connect Timeout Error"));
    markFailed.mockRejectedValue(new Error("db down"));

    expect(await startCheckout({ plan: "MONTHLY", currency: "XOF" })).toMatchObject({
      success: false,
      error: "Could not start the payment. Try again.",
    });
  });

  it("skips storing an id when the charge returns none", async () => {
    charge.mockResolvedValue({ transactionId: null, redirectUrl: CHECKOUT_LINK });

    expect(await startCheckout({ plan: "MONTHLY", currency: "USD" })).toMatchObject({ success: true });
    expect(setTransactionId).not.toHaveBeenCalled();
  });
});

describe("refreshPaymentStatus", () => {
  it("returns the status of the user's own payment", async () => {
    findPayment.mockResolvedValue({ reference: REFERENCE, userId: USER_ID, status: "SUCCEEDED" });

    expect(await refreshPaymentStatus(REFERENCE)).toEqual({ status: "SUCCEEDED" });
    expect(findPayment).toHaveBeenCalledWith(REFERENCE);
  });

  it("refuses another user's reference", async () => {
    findPayment.mockResolvedValue({ reference: REFERENCE, userId: "user_2", status: "SUCCEEDED" });

    expect(await refreshPaymentStatus(REFERENCE)).toEqual({ status: null });
  });

  it("returns null when signed out, for an unknown reference, or for junk input", async () => {
    findPayment.mockResolvedValue(null);
    expect(await refreshPaymentStatus("cortex_unknown")).toEqual({ status: null });
    expect(await refreshPaymentStatus(42)).toEqual({ status: null });

    session.mockResolvedValue(null);
    expect(await refreshPaymentStatus(REFERENCE)).toEqual({ status: null });
  });
});

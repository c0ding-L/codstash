import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import failedFixture from "@/lib/__fixtures__/bictorys/webhook-xof-card-failed.json";
import succeededFixture from "@/lib/__fixtures__/bictorys/webhook-xof-card-succeeded.json";
import {
  amountMatches,
  applyPaymentStatus,
  handleBictorysWebhook,
  verifyWebhook,
  webhookPayloadSchema,
} from "@/lib/billing-webhook";
import {
  findPaymentByReference,
  markPaymentFailed,
  markPaymentNeedsReview,
  markPaymentSucceeded,
} from "@/lib/db/billing";

vi.mock("@/lib/db/billing", () => ({
  findPaymentByReference: vi.fn(),
  markPaymentSucceeded: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentNeedsReview: vi.fn(),
  isSettleable: vi.fn((status: string) => status === "PENDING" || status === "FAILED"),
}));

const asMock = (fn: unknown) => fn as Mock;
const findPayment = asMock(findPaymentByReference);
const succeed = asMock(markPaymentSucceeded);
const fail = asMock(markPaymentFailed);
const review = asMock(markPaymentNeedsReview);

const SECRET = "whsec_test_secret";
const NOW = 1_795_400_000_000;

/** The captured headers, with the placeholder secret swapped for the test one. */
function headersFor(fixture: { headers: Record<string, string> }, overrides: Record<string, string | null> = {}) {
  const headers = new Headers({ ...fixture.headers, "x-secret-key": SECRET });
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
}

const succeededBody = succeededFixture.body;
const REFERENCE = succeededBody.paymentReference;
const TX_ID = succeededBody.id;

/** The row `startCheckout` would have created for the captured charge. */
const payment = (overrides: object = {}) => ({
  id: "pay_1",
  reference: REFERENCE,
  amount: 4000,
  currency: "XOF",
  status: "PENDING",
  // Before the webhook, the row holds the hosted checkout's chargeId.
  transactionId: "e37b479a-574c-4c32-b1ce-e8b68959cf13",
  ...overrides,
});

beforeEach(() => {
  succeed.mockResolvedValue({ applied: true, proUntil: new Date(NOW) });
  fail.mockResolvedValue({ count: 1 });
  review.mockResolvedValue({ count: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verifyWebhook", () => {
  const raw = JSON.stringify(succeededBody);
  const sign = (timestamp: string, body = raw) =>
    createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");

  it("accepts the captured headers: the secret key alone, no HMAC headers", () => {
    expect(verifyWebhook(headersFor(succeededFixture), raw, SECRET, NOW)).toBe(true);
  });

  it("refuses a missing, wrong or different-length key", () => {
    expect(verifyWebhook(headersFor(succeededFixture, { "x-secret-key": null }), raw, SECRET, NOW)).toBe(false);
    expect(verifyWebhook(headersFor(succeededFixture, { "x-secret-key": "whsec_test_secreX" }), raw, SECRET, NOW)).toBe(
      false,
    );
    expect(verifyWebhook(headersFor(succeededFixture, { "x-secret-key": "short" }), raw, SECRET, NOW)).toBe(false);
  });

  it("refuses everything when the secret is not configured", () => {
    expect(verifyWebhook(headersFor(succeededFixture, { "x-secret-key": "" }), raw, "", NOW)).toBe(false);
  });

  it("checks the HMAC when both headers are present", () => {
    const timestamp = String(NOW);
    const good = { "x-webhook-timestamp": timestamp, "x-webhook-signature": sign(timestamp) };
    expect(verifyWebhook(headersFor(succeededFixture, good), raw, SECRET, NOW)).toBe(true);

    const tampered = { ...good, "x-webhook-signature": sign(timestamp, raw.replace("4000", "1")) };
    expect(verifyWebhook(headersFor(succeededFixture, tampered), raw, SECRET, NOW)).toBe(false);
  });

  it("accepts a timestamp in seconds", () => {
    const timestamp = String(NOW / 1000);
    const headers = headersFor(succeededFixture, { "x-webhook-timestamp": timestamp, "x-webhook-signature": sign(timestamp) });
    expect(verifyWebhook(headers, raw, SECRET, NOW)).toBe(true);
  });

  it("refuses a stale or non-numeric timestamp", () => {
    const stale = String(NOW - 6 * 60 * 1000);
    const staleHeaders = headersFor(succeededFixture, { "x-webhook-timestamp": stale, "x-webhook-signature": sign(stale) });
    expect(verifyWebhook(staleHeaders, raw, SECRET, NOW)).toBe(false);

    const junkHeaders = headersFor(succeededFixture, { "x-webhook-timestamp": "soon", "x-webhook-signature": sign("soon") });
    expect(verifyWebhook(junkHeaders, raw, SECRET, NOW)).toBe(false);
  });

  it("ignores a lone signature header", () => {
    const headers = headersFor(succeededFixture, { "x-webhook-signature": "garbage" });
    expect(verifyWebhook(headers, raw, SECRET, NOW)).toBe(true);
  });
});

describe("webhookPayloadSchema", () => {
  it("parses both captured payloads and keeps unknown fields", () => {
    const parsed = webhookPayloadSchema.parse(succeededBody);
    expect(parsed).toMatchObject({ paymentReference: REFERENCE, status: "succeeded", amount: 4000, currency: "XOF" });
    expect(parsed.id).toBe(TX_ID);
    expect((parsed as Record<string, unknown>).settledAmount).toBe(4000);

    expect(webhookPayloadSchema.parse(failedFixture.body).status).toBe("failed");
  });

  it("accepts an amount sent as a string", () => {
    expect(webhookPayloadSchema.parse({ ...succeededBody, amount: "4000" }).amount).toBe(4000);
  });

  it("rejects a payload without a reference or with a junk amount", () => {
    expect(webhookPayloadSchema.safeParse({ ...succeededBody, paymentReference: undefined }).success).toBe(false);
    expect(webhookPayloadSchema.safeParse({ ...succeededBody, amount: "lots" }).success).toBe(false);
  });
});

describe("amountMatches", () => {
  it("compares with the charged amount, numerically", () => {
    expect(amountMatches(4000.0, 4000)).toBe(true);
    // Fees are reported apart, so the charged amount minus fees is a mismatch.
    expect(amountMatches(4000 - 121.9, 4000)).toBe(false);
  });
});

describe("applyPaymentStatus", () => {
  const paid = { status: "succeeded", amount: 4000, currency: "XOF", transactionId: TX_ID };

  it("grants Pro for succeeded and authorized, storing the transaction id", async () => {
    findPayment.mockResolvedValue(payment());

    expect(await applyPaymentStatus(REFERENCE, paid)).toBe("SUCCEEDED");
    expect(await applyPaymentStatus(REFERENCE, { ...paid, status: "authorized" })).toBe("SUCCEEDED");
    expect(succeed).toHaveBeenCalledWith(REFERENCE, { transactionId: TX_ID });
  });

  it("settles a FAILED row, since a link can be paid again after a declined card", async () => {
    findPayment.mockResolvedValue(payment({ status: "FAILED", transactionId: failedFixture.body.id }));

    expect(await applyPaymentStatus(REFERENCE, paid)).toBe("SUCCEEDED");
    expect(succeed).toHaveBeenCalledOnce();
  });

  it("sends a wrong currency or amount to review, without Pro", async () => {
    findPayment.mockResolvedValue(payment());

    expect(await applyPaymentStatus(REFERENCE, { ...paid, currency: "EUR" })).toBe("NEEDS_REVIEW");
    expect(await applyPaymentStatus(REFERENCE, { ...paid, amount: 1000 })).toBe("NEEDS_REVIEW");
    expect(review).toHaveBeenCalledWith(REFERENCE, TX_ID);
    expect(succeed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("skips the amount check when the report has no amount", async () => {
    findPayment.mockResolvedValue(payment());

    expect(await applyPaymentStatus(REFERENCE, { status: "succeeded" })).toBe("SUCCEEDED");
  });

  it("marks failed and cancelled payments failed", async () => {
    findPayment.mockResolvedValue(payment());

    expect(await applyPaymentStatus(REFERENCE, { status: "failed", transactionId: "tx_f" })).toBe("FAILED");
    expect(await applyPaymentStatus(REFERENCE, { status: "cancelled" })).toBe("FAILED");
    expect(fail).toHaveBeenCalledWith(REFERENCE, "tx_f");
  });

  it("changes nothing for pending, processing or reversed", async () => {
    findPayment.mockResolvedValue(payment());

    for (const status of ["pending", "processing", "reversed"]) {
      expect(await applyPaymentStatus(REFERENCE, { status })).toBe("PENDING");
    }
    expect(succeed).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  });

  it("logs an unknown status instead of dropping it silently", async () => {
    findPayment.mockResolvedValue(payment());

    expect(await applyPaymentStatus(REFERENCE, { ...paid, status: "success" })).toBe("PENDING");
    expect(succeed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("unknown payment status"),
      expect.objectContaining({ status: "success" }),
    );
  });

  it("logs nothing while a payment is pending or processing", async () => {
    findPayment.mockResolvedValue(payment());

    await applyPaymentStatus(REFERENCE, { status: "pending" });
    await applyPaymentStatus(REFERENCE, { status: "processing" });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("never lets a late failure undo a success", async () => {
    findPayment.mockResolvedValue(payment({ status: "SUCCEEDED", transactionId: TX_ID }));

    expect(await applyPaymentStatus(REFERENCE, { status: "failed" })).toBe("SUCCEEDED");
    expect(fail).not.toHaveBeenCalled();
  });

  it("ignores a retried webhook quietly", async () => {
    findPayment.mockResolvedValue(payment({ status: "SUCCEEDED", transactionId: TX_ID }));

    expect(await applyPaymentStatus(REFERENCE, paid)).toBe("SUCCEEDED");
    expect(succeed).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs a second real payment on a settled checkout, without Pro", async () => {
    findPayment.mockResolvedValue(payment({ status: "SUCCEEDED", transactionId: TX_ID }));

    expect(await applyPaymentStatus(REFERENCE, { ...paid, transactionId: "another-transaction" })).toBe("SUCCEEDED");
    expect(succeed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("second payment"),
      expect.objectContaining({ transactionId: "another-transaction" }),
    );
  });

  it("leaves a NEEDS_REVIEW row alone", async () => {
    findPayment.mockResolvedValue(payment({ status: "NEEDS_REVIEW", transactionId: TX_ID }));

    expect(await applyPaymentStatus(REFERENCE, paid)).toBe("NEEDS_REVIEW");
    expect(succeed).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown reference", async () => {
    findPayment.mockResolvedValue(null);

    expect(await applyPaymentStatus("cortex_unknown", paid)).toBeNull();
    expect(succeed).not.toHaveBeenCalled();
  });
});

describe("handleBictorysWebhook", () => {
  beforeEach(() => {
    vi.stubEnv("BICTORYS_WEBHOOK_SECRET", SECRET);
  });

  it("handles the captured succeeded webhook", async () => {
    findPayment.mockResolvedValue(payment());

    const result = await handleBictorysWebhook(headersFor(succeededFixture), JSON.stringify(succeededBody));

    expect(result).toEqual({ status: 200 });
    expect(succeed).toHaveBeenCalledWith(REFERENCE, { transactionId: TX_ID });
  });

  it("handles the captured failed webhook", async () => {
    findPayment.mockResolvedValue(payment({ reference: failedFixture.body.paymentReference }));

    const result = await handleBictorysWebhook(headersFor(failedFixture), JSON.stringify(failedFixture.body));

    expect(result).toEqual({ status: 200 });
    expect(fail).toHaveBeenCalledWith(failedFixture.body.paymentReference, failedFixture.body.id);
  });

  it("answers 401 to a forged webhook and touches nothing", async () => {
    const headers = headersFor(succeededFixture, { "x-secret-key": "not-the-secret" });

    expect(await handleBictorysWebhook(headers, JSON.stringify(succeededBody))).toEqual({ status: 401 });
    expect(findPayment).not.toHaveBeenCalled();
  });

  it("answers 401 when the secret is not configured", async () => {
    vi.stubEnv("BICTORYS_WEBHOOK_SECRET", "");

    expect(await handleBictorysWebhook(headersFor(succeededFixture), JSON.stringify(succeededBody))).toEqual({
      status: 401,
    });
  });

  it("answers 400 to invalid JSON", async () => {
    expect(await handleBictorysWebhook(headersFor(succeededFixture), "{not json")).toEqual({ status: 400 });
  });

  it("acknowledges an unrecognised payload or an unknown reference", async () => {
    expect(await handleBictorysWebhook(headersFor(succeededFixture), JSON.stringify({ hello: "world" }))).toEqual({
      status: 200,
    });

    findPayment.mockResolvedValue(null);
    expect(await handleBictorysWebhook(headersFor(succeededFixture), JSON.stringify(succeededBody))).toEqual({
      status: 200,
    });
    expect(succeed).not.toHaveBeenCalled();
  });

  it("lets a DB error propagate, so the route answers 500 and Bictorys retries", async () => {
    findPayment.mockRejectedValue(new Error("connection lost"));

    await expect(handleBictorysWebhook(headersFor(succeededFixture), JSON.stringify(succeededBody))).rejects.toThrow(
      "connection lost",
    );
  });
});

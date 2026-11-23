import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  createPendingPayment,
  getPlanStatus,
  markPaymentFailed,
  markPaymentNeedsReview,
  markPaymentSucceeded,
  setPaymentTransactionId,
} from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn() },
    item: { count: vi.fn() },
    collection: { count: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const transaction = asMock(prisma.$transaction);
const queryRaw = asMock(prisma.$queryRaw);
const findUser = asMock(prisma.user.findUnique);
const updateUser = asMock(prisma.user.update);
const countItems = asMock(prisma.item.count);
const countCollections = asMock(prisma.collection.count);
const createPayment = asMock(prisma.payment.create);
const updatePayments = asMock(prisma.payment.updateMany);
const findPayment = asMock(prisma.payment.findUnique);

const USER = "user_a";
const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-22T12:00:00Z");

beforeEach(() => {
  // The callback gets the mocked client as `tx`.
  transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
});

describe("getPlanStatus", () => {
  it("counts the user's rows and decides Pro from proUntil", async () => {
    const proUntil = new Date(Date.now() + DAY_MS);
    findUser.mockResolvedValue({ proUntil });
    countItems.mockResolvedValue(12);
    countCollections.mockResolvedValue(2);

    expect(await getPlanStatus(USER)).toEqual({ proUntil, isPro: true, items: 12, collections: 2 });
    expect(countItems.mock.calls[0]![0].where).toEqual({ userId: USER });
    expect(countCollections.mock.calls[0]![0].where).toEqual({ userId: USER });
  });

  it("is Free when proUntil has passed or the user is gone", async () => {
    countItems.mockResolvedValue(0);
    countCollections.mockResolvedValue(0);

    findUser.mockResolvedValue({ proUntil: new Date(Date.now() - DAY_MS) });
    expect((await getPlanStatus(USER)).isPro).toBe(false);

    findUser.mockResolvedValue(null);
    expect(await getPlanStatus(USER)).toEqual({ proUntil: null, isPro: false, items: 0, collections: 0 });
  });
});

describe("createPendingPayment", () => {
  it("stores the amount and currency to be charged", async () => {
    await createPendingPayment(USER, "YEARLY", { amount: 41_325, currency: "XOF" });

    const { data } = createPayment.mock.calls[0]![0];
    expect(data).toMatchObject({ userId: USER, plan: "YEARLY", currency: "XOF", amount: 41_325 });
    expect(data.reference).toMatch(/^cortex_[a-f0-9]{32}$/);
  });

  it("builds a new reference each time", async () => {
    await createPendingPayment(USER, "MONTHLY", { amount: 4_000, currency: "XOF" });
    await createPendingPayment(USER, "MONTHLY", { amount: 4_000, currency: "XOF" });

    expect(createPayment.mock.calls[0]![0].data.reference).not.toBe(createPayment.mock.calls[1]![0].data.reference);
  });
});

describe("setPaymentTransactionId", () => {
  it("stores the id only while none is stored, so a webhook's id is never overwritten", async () => {
    await setPaymentTransactionId("pay_1", "tx_1");

    expect(updatePayments).toHaveBeenCalledWith({
      where: { id: "pay_1", transactionId: null },
      data: { transactionId: "tx_1" },
    });
  });
});

describe("markPaymentSucceeded", () => {
  const pending = (overrides: object = {}) => ({
    id: "pay_1",
    reference: "cortex_1",
    status: "PENDING",
    plan: "MONTHLY",
    userId: USER,
    ...overrides,
  });

  it("claims the PENDING row, extends proUntil and sets isPro", async () => {
    const active = new Date(NOW.getTime() + 10 * DAY_MS);
    findPayment.mockResolvedValue(pending({ plan: "YEARLY" }));
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ proUntil: active }]);

    const result = await markPaymentSucceeded("cortex_1", { now: NOW });

    const proUntil = new Date(NOW.getTime() + 375 * DAY_MS);
    expect(result).toEqual({ applied: true, proUntil });
    expect(transaction).toHaveBeenCalledOnce();
    expect(updatePayments).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SUCCEEDED", paidAt: NOW },
    });
    expect(updateUser).toHaveBeenCalledWith({ where: { id: USER }, data: { proUntil, isPro: true } });
  });

  it("stores the webhook's transaction id", async () => {
    findPayment.mockResolvedValue(pending());
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ proUntil: null }]);

    await markPaymentSucceeded("cortex_1", { transactionId: "tx_9", now: NOW });

    expect(updatePayments.mock.calls[0]![0].data).toEqual({ status: "SUCCEEDED", paidAt: NOW, transactionId: "tx_9" });
  });

  // One checkout link can be paid again after a declined card.
  it("settles a FAILED row", async () => {
    findPayment.mockResolvedValue(pending({ status: "FAILED" }));
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ proUntil: null }]);

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({
      applied: true,
      proUntil: new Date(NOW.getTime() + 30 * DAY_MS),
    });
  });

  it("leaves a NEEDS_REVIEW row alone", async () => {
    findPayment.mockResolvedValue(pending({ status: "NEEDS_REVIEW" }));

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({ applied: false });
    expect(updatePayments).not.toHaveBeenCalled();
  });

  // A concurrent payment of the same user may have moved proUntil since the
  // payment was read; only the value read under the lock counts.
  it("extends the proUntil read under FOR UPDATE", async () => {
    findPayment.mockResolvedValue(pending());
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ proUntil: new Date(NOW.getTime() + 30 * DAY_MS) }]);

    const result = await markPaymentSucceeded("cortex_1", { now: NOW });

    expect(result).toEqual({ applied: true, proUntil: new Date(NOW.getTime() + 60 * DAY_MS) });
    const [strings, userId] = queryRaw.mock.calls[0]!;
    expect(strings.join("?")).toMatch(/SELECT "proUntil" FROM "User" WHERE "id" = \? FOR UPDATE/);
    expect(userId).toBe(USER);
    // The lock is taken only after the payment is claimed.
    expect(updatePayments.mock.invocationCallOrder[0]).toBeLessThan(queryRaw.mock.invocationCallOrder[0]!);
  });

  it("counts from now when the user never paid", async () => {
    findPayment.mockResolvedValue(pending());
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ proUntil: null }]);

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({
      applied: true,
      proUntil: new Date(NOW.getTime() + 30 * DAY_MS),
    });
  });

  it("does nothing the second time", async () => {
    findPayment.mockResolvedValue(pending({ status: "SUCCEEDED" }));

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({ applied: false });
    expect(updatePayments).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does nothing when a concurrent call claimed the row first", async () => {
    findPayment.mockResolvedValue(pending());
    updatePayments.mockResolvedValue({ count: 0 });

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({ applied: false });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown reference", async () => {
    findPayment.mockResolvedValue(null);

    expect(await markPaymentSucceeded("cortex_unknown", { now: NOW })).toEqual({ applied: false });
    expect(updatePayments).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("records the payment of a deleted user without a user update", async () => {
    findPayment.mockResolvedValue(pending({ userId: null }));
    updatePayments.mockResolvedValue({ count: 1 });

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({ applied: true, proUntil: null });
    expect(updatePayments).toHaveBeenCalledOnce();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("skips the user update when the user is deleted after the payment is read", async () => {
    findPayment.mockResolvedValue(pending());
    updatePayments.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([]);

    expect(await markPaymentSucceeded("cortex_1", { now: NOW })).toEqual({ applied: true, proUntil: null });
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("markPaymentFailed / markPaymentNeedsReview", () => {
  it("fail only a PENDING row; review a PENDING or FAILED one", async () => {
    await markPaymentFailed("cortex_1");
    await markPaymentNeedsReview("cortex_2");

    expect(updatePayments).toHaveBeenNthCalledWith(1, {
      where: { reference: "cortex_1", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(updatePayments).toHaveBeenNthCalledWith(2, {
      where: { reference: "cortex_2", status: { in: ["PENDING", "FAILED"] } },
      data: { status: "NEEDS_REVIEW" },
    });
  });

  it("store the webhook's transaction id when given", async () => {
    await markPaymentFailed("cortex_1", "tx_1");
    await markPaymentNeedsReview("cortex_2", "tx_2");

    expect(updatePayments.mock.calls[0]![0].data).toEqual({ status: "FAILED", transactionId: "tx_1" });
    expect(updatePayments.mock.calls[1]![0].data).toEqual({ status: "NEEDS_REVIEW", transactionId: "tx_2" });
  });
});

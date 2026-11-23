import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_PLANS } from "@/lib/billing-plans";
import { chargeFor, clearRateCache, getUsdToEurRate } from "@/lib/exchange-rates";

const fetchMock = vi.fn();

/** The shape Frankfurter answers with (captured 2026-11-23). */
const rateResponse = (rate: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => ({ amount: 1.0, base: "USD", date: "2026-11-20", rates: { EUR: rate } }),
});

beforeEach(() => {
  clearRateCache();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(rateResponse(0.90992));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getUsdToEurRate", () => {
  it("reads the ECB rate", async () => {
    expect(await getUsdToEurRate()).toBe(0.90992);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
  });

  it("keeps the rate in memory for 12 hours", async () => {
    const t0 = Date.UTC(2026, 10, 23, 8);
    const HOUR = 3_600_000;
    await getUsdToEurRate(t0);

    fetchMock.mockResolvedValue(rateResponse(0.95));
    expect(await getUsdToEurRate(t0 + 11 * HOUR)).toBe(0.90992);
    expect(fetchMock).toHaveBeenCalledOnce();

    expect(await getUsdToEurRate(t0 + 12 * HOUR)).toBe(0.95);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on an error status or a missing rate", async () => {
    fetchMock.mockResolvedValue(rateResponse(0.9, false, 503));
    await expect(getUsdToEurRate()).rejects.toThrow("503");

    fetchMock.mockResolvedValue(rateResponse(undefined));
    await expect(getUsdToEurRate()).rejects.toThrow();

    fetchMock.mockResolvedValue(rateResponse(0));
    await expect(getUsdToEurRate()).rejects.toThrow();
  });
});

describe("chargeFor", () => {
  it("charges XOF as priced, with Mobile Money", async () => {
    expect(await chargeFor("MONTHLY", "XOF")).toEqual({ amount: 4_000, currency: "XOF", cardOnly: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("charges EUR in XOF at the fixed parity, card only", async () => {
    expect(await chargeFor("MONTHLY", "EUR")).toEqual({ amount: 4_592, currency: "XOF", cardOnly: true });
    expect(await chargeFor("YEARLY", "EUR")).toEqual({ amount: 41_325, currency: "XOF", cardOnly: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("charges USD in XOF through the day's rate, card only", async () => {
    const expected = Math.round(BILLING_PLANS.YEARLY.price.USD * 0.90992 * 655.957);

    expect(await chargeFor("YEARLY", "USD")).toEqual({ amount: expected, currency: "XOF", cardOnly: true });
  });

  it("fails a USD charge when the rate cannot be read", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(chargeFor("MONTHLY", "USD")).rejects.toThrow("network down");
  });
});

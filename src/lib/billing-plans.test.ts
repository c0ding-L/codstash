import { describe, expect, it } from "vitest";

import { BILLING_PLANS, CURRENCIES, PLANS, extendProUntil, formatPrice, isProActive } from "@/lib/billing-plans";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-22T12:00:00Z");

describe("BILLING_PLANS", () => {
  it.each(PLANS.flatMap((plan) => CURRENCIES.map((currency) => [plan, currency] as const)))(
    "%s has a whole, positive %s price",
    (plan, currency) => {
      const price = BILLING_PLANS[plan].price[currency];
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
    },
  );

  // Bictorys's XOF minimum.
  it.each(PLANS)("%s costs at least 100 XOF", (plan) => {
    expect(BILLING_PLANS[plan].price.XOF).toBeGreaterThanOrEqual(100);
  });
});

describe("formatPrice", () => {
  it("formats each currency", () => {
    expect(formatPrice(7, "USD")).toBe("$7");
    expect(formatPrice(7, "EUR")).toBe("€7");
    // A plain U+0020 space, not the narrow no-break space fr-FR emits.
    expect(formatPrice(4_000, "XOF")).toBe("4 000 FCFA");
    expect(formatPrice(36_000, "XOF")).toBe("36 000 FCFA");
  });
});

describe("isProActive", () => {
  it("is false for null and undefined", () => {
    expect(isProActive(null, NOW)).toBe(false);
    expect(isProActive(undefined, NOW)).toBe(false);
  });

  it("is false in the past and true in the future", () => {
    expect(isProActive(new Date(NOW.getTime() - 1), NOW)).toBe(false);
    expect(isProActive(new Date(NOW.getTime() + 1), NOW)).toBe(true);
  });

  it("has expired at exactly now", () => {
    expect(isProActive(new Date(NOW), NOW)).toBe(false);
  });
});

describe("extendProUntil", () => {
  it("counts from now when never paid", () => {
    expect(extendProUntil(null, 30, NOW)).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
  });

  it("counts from now after expiry", () => {
    const expired = new Date(NOW.getTime() - 5 * DAY_MS);
    expect(extendProUntil(expired, 30, NOW)).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
  });

  it("adds to the remaining time while active", () => {
    const active = new Date(NOW.getTime() + 10 * DAY_MS);
    expect(extendProUntil(active, 365, NOW)).toEqual(new Date(NOW.getTime() + 375 * DAY_MS));
  });
});

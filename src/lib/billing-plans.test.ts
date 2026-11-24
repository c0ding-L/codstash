import { describe, expect, it } from "vitest";

import {
  BILLING_PLANS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  PAYMENT_METHODS,
  PLANS,
  XOF_PER_EUR,
  extendProUntil,
  formatPrice,
  formatProUntil,
  formatYearlyPerMonth,
  isProActive,
  parseCurrency,
  toXof,
} from "@/lib/billing-plans";

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

describe("parseCurrency", () => {
  it("reads a supported currency, in any case", () => {
    expect(parseCurrency("XOF")).toBe("XOF");
    expect(parseCurrency("eur")).toBe("EUR");
    expect(parseCurrency(["usd", "xof"])).toBe("USD");
  });

  it("falls back to the default otherwise", () => {
    expect(parseCurrency(undefined)).toBe(DEFAULT_CURRENCY);
    expect(parseCurrency("GBP")).toBe(DEFAULT_CURRENCY);
    expect(parseCurrency("")).toBe(DEFAULT_CURRENCY);
  });
});

describe("PAYMENT_METHODS", () => {
  it("offers Mobile Money in XOF only", () => {
    for (const currency of CURRENCIES) {
      expect(PAYMENT_METHODS[currency].includes("Mobile Money")).toBe(currency === "XOF");
    }
  });
});

describe("formatProUntil", () => {
  it("formats the day in UTC", () => {
    expect(formatProUntil(new Date("2026-12-23T23:30:00Z"))).toBe("December 23, 2026");
  });
});

describe("toXof", () => {
  it("keeps XOF as it is", () => {
    expect(toXof(4_000, "XOF")).toBe(4_000);
  });

  it("converts EUR at the fixed parity, rounded to the franc", () => {
    expect(XOF_PER_EUR).toBe(655.957);
    expect(toXof(7, "EUR")).toBe(4_592);
    expect(toXof(63, "EUR")).toBe(41_325);
  });

  it("converts USD through the day's USD→EUR rate", () => {
    expect(toXof(7, "USD", 0.90992)).toBe(Math.round(7 * 0.90992 * 655.957));
  });

  it("refuses USD without a usable rate", () => {
    expect(() => toXof(7, "USD")).toThrow();
    expect(() => toXof(7, "USD", 0)).toThrow();
    expect(() => toXof(7, "USD", Number.NaN)).toThrow();
  });
});

describe("formatYearlyPerMonth", () => {
  it("shows cents for USD and EUR", () => {
    expect(formatYearlyPerMonth("USD")).toBe("$5.25");
    expect(formatYearlyPerMonth("EUR")).toBe("€5.25");
  });

  it("rounds XOF to the franc", () => {
    expect(formatYearlyPerMonth("XOF")).toBe("3 000 FCFA");
  });
});

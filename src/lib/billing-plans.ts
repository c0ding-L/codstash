// Pure and client-safe: client components import this in Phase 2, so no
// Node-only modules and no Prisma (whose generated enums share these names).

import type { Locale } from "@/lib/locale";

export const CURRENCIES = ["USD", "EUR", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PLANS = ["MONTHLY", "YEARLY"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Prices in major units, set by hand per currency (no live conversion). `label` is the charge
 * description sent to Bictorys, not UI text, so it stays in English.
 */
export const BILLING_PLANS = {
  MONTHLY: { days: 30, label: "Cortex Pro — 1 month", price: { USD: 7, EUR: 7, XOF: 4_000 } },
  YEARLY: { days: 365, label: "Cortex Pro — 1 year", price: { USD: 63, EUR: 63, XOF: 36_000 } },
} as const satisfies Record<Plan, { days: number; label: string; price: Record<Currency, number> }>;

export const DEFAULT_CURRENCY: Currency = "USD";

/** A `?currency=` value, or the default when it is missing or not one Cortex charges. */
export function parseCurrency(value: unknown): Currency {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && (CURRENCIES as readonly string[]).includes(candidate.toUpperCase())
    ? (candidate.toUpperCase() as Currency)
    : DEFAULT_CURRENCY;
}

/**
 * Currencies Bictorys card payments accept as they are. EUR/USD cards are
 * refused ("payment channel is not configured", plan §10 q10), so those
 * prices are shown as chosen but charged in XOF. Add "EUR" / "USD" here if
 * Bictorys enables them.
 */
export const CHARGED_DIRECTLY: readonly Currency[] = ["XOF"];

/** The legal fixed parity of the CFA franc. */
export const XOF_PER_EUR = 655.957;

/**
 * A price in XOF, rounded to the franc. EUR uses the fixed parity; USD needs
 * the day's USD→EUR rate (`src/lib/exchange-rates.ts`).
 */
export function toXof(amount: number, currency: Currency, usdToEur?: number) {
  if (currency === "XOF") return amount;
  if (currency === "EUR") return Math.round(amount * XOF_PER_EUR);
  if (usdToEur === undefined || !(usdToEur > 0)) throw new Error("A USD→EUR rate is required to convert USD.");
  return Math.round(amount * usdToEur * XOF_PER_EUR);
}

/**
 * What the Bictorys checkout offers per currency (sandbox-verified, plan §2.1), as a key of the
 * `billing.paymentMethods` messages.
 */
export const PAYMENT_METHODS: Record<Currency, "card" | "cardOrMobileMoney"> = {
  USD: "card",
  EUR: "card",
  XOF: "cardOrMobileMoney",
};

/** The BCP 47 tag `Intl` formats prices and dates with, per UI language. */
const INTL_LOCALE: Record<Locale, string> = { en: "en-US", fr: "fr-FR" };

/**
 * "$7", "€7", "4 000 FCFA" in English; "7 $US", "7 €" in French. XOF is formatted by hand in
 * every language: Intl's XOF output ("F CFA 4,000") is not how prices are written locally. The
 * thousands separator is a plain space, whatever space `fr-FR` happens to emit.
 */
export function formatPrice(amount: number, currency: Currency, locale: Locale = "en") {
  if (currency === "XOF") return `${amount.toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
  return normalizeSpaces(
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(amount),
  );
}

/** French `Intl` output uses narrow no-break spaces; a plain no-break space renders the same everywhere. */
function normalizeSpaces(text: string) {
  return text.replace(/[\u202f\u00a0]/g, "\u00a0");
}

/**
 * The yearly price per month: "$5.25", "€5.25", "3 000 FCFA". Cents for USD/EUR,
 * whole francs for XOF.
 */
export function formatYearlyPerMonth(currency: Currency, locale: Locale = "en") {
  const perMonth = BILLING_PLANS.YEARLY.price[currency] / 12;
  if (currency === "XOF") return formatPrice(Math.round(perMonth), currency);
  return normalizeSpaces(
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency, maximumFractionDigits: 2 }).format(perMonth),
  );
}

const DAY_MS = 86_400_000;

/** The only place that decides whether a user is Pro. Expires at `proUntil` exactly. */
export function isProActive(proUntil: Date | null | undefined, now = new Date()) {
  return proUntil != null && proUntil.getTime() > now.getTime();
}

/** Paying early stacks on the remaining time; paying after expiry starts from now. */
export function extendProUntil(current: Date | null | undefined, days: number, now = new Date()) {
  const start = current && current.getTime() > now.getTime() ? current : now;
  return new Date(start.getTime() + days * DAY_MS);
}

/** "December 23, 2026" / "23 décembre 2026": the day Pro ends, in UTC so server and client agree. */
export function formatProUntil(proUntil: Date, locale: Locale = "en") {
  return proUntil.toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "long", timeZone: "UTC" });
}

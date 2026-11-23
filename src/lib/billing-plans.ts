// Pure and client-safe: client components import this in Phase 2, so no
// Node-only modules and no Prisma (whose generated enums share these names).

export const CURRENCIES = ["USD", "EUR", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PLANS = ["MONTHLY", "YEARLY"] as const;
export type Plan = (typeof PLANS)[number];

/** Prices in major units, set by hand per currency (no live conversion). */
export const BILLING_PLANS = {
  MONTHLY: { days: 30, label: "Cortex Pro — 1 month", price: { USD: 7, EUR: 7, XOF: 4_000 } },
  YEARLY: { days: 365, label: "Cortex Pro — 1 year", price: { USD: 63, EUR: 63, XOF: 36_000 } },
} as const satisfies Record<Plan, { days: number; label: string; price: Record<Currency, number> }>;

export const DEFAULT_CURRENCY: Currency = "USD";

/**
 * "$7", "€7", "4 000 FCFA". XOF is formatted by hand: Intl's XOF output
 * ("F CFA 4,000") is not how prices are written locally. The thousands
 * separator is a plain space, whatever space `fr-FR` happens to emit.
 */
export function formatPrice(amount: number, currency: Currency) {
  if (currency === "XOF") return `${amount.toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
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

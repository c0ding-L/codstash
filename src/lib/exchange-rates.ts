import { BILLING_PLANS, CHARGED_DIRECTLY, toXof, type Currency, type Plan } from "@/lib/billing-plans";

// Server-only. Turns the price the customer chose into what Bictorys charges.

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR";
const TIMEOUT_MS = 10_000;
/** ECB rates change once a working day; half a day is fresh enough. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Kept in memory per server instance: the Next docs do not promise that a
// fetch inside a Server Action is cached, so the cache is explicit.
let cached: { rate: number; at: number } | null = null;

/** For tests. */
export function clearRateCache() {
  cached = null;
}

/**
 * USD→EUR from the European Central Bank (Frankfurter, no API key). The ECB
 * does not publish XOF, but EUR→XOF is a fixed parity, so this is the only
 * rate needed. Throws when the rate cannot be read and none is cached.
 */
export async function getUsdToEurRate(now = Date.now()): Promise<number> {
  if (cached && now - cached.at < MAX_AGE_MS) return cached.rate;

  const response = await fetch(FRANKFURTER_URL, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`);
  const data = (await response.json()) as { rates?: { EUR?: unknown } };
  const rate = data.rates?.EUR;
  if (typeof rate !== "number" || !(rate > 0)) throw new Error("Exchange rate response has no USD→EUR rate");

  cached = { rate, at: now };
  return rate;
}

export interface Charge {
  /** What Bictorys charges, in major units. */
  amount: number;
  currency: Currency;
  /** EUR/USD customers pay by card; Mobile Money is for XOF only. */
  cardOnly: boolean;
}

/** The amount and currency sent to Bictorys for a plan priced in `currency`. */
export async function chargeFor(plan: Plan, currency: Currency): Promise<Charge> {
  const price = BILLING_PLANS[plan].price[currency];
  const cardOnly = currency !== "XOF";
  if (CHARGED_DIRECTLY.includes(currency)) return { amount: price, currency, cardOnly };

  const usdToEur = currency === "USD" ? await getUsdToEurRate() : undefined;
  return { amount: toXof(price, currency, usdToEur), currency: "XOF", cardOnly };
}

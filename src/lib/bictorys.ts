import type { Currency } from "@/lib/billing-plans";

// Thin client for the two Bictorys calls Cortex makes. Server-only: it reads
// the API key from the environment.

const TIMEOUT_MS = 15_000;
/** Error bodies can be whole HTML pages (a WAF 403); keep only an excerpt. */
const MAX_ERROR_BODY = 300;

function config() {
  const baseUrl = process.env.BICTORYS_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.BICTORYS_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BICTORYS_API_URL / BICTORYS_API_KEY are not set");
  return { baseUrl, apiKey };
}

export interface CreateChargeInput {
  amount: number;
  currency: Currency;
  /** Our `Payment.reference`, sent as `paymentReference`. */
  reference: string;
  /** The user id. */
  merchantReference: string;
  label: string;
  successUrl: string;
  errorUrl: string;
  customer: { name?: string | null; email: string };
}

export interface CreatedCharge {
  transactionId: string | null;
  redirectUrl: string;
}

export async function createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}/pay/v1/charges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      paymentReference: input.reference,
      merchantReference: input.merchantReference,
      successRedirectUrl: input.successUrl,
      errorRedirectUrl: input.errorUrl,
      customerObject: { name: input.customer.name ?? undefined, email: input.customer.email },
      orderDetails: [{ name: input.label, price: input.amount, quantity: 1 }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, MAX_ERROR_BODY);
    throw new Error(`Bictorys charge failed: ${response.status} ${body}`);
  }

  // Hosted checkout answers 202 { link, chargeId } (sandbox-verified); the
  // documented direct-charge shape is 201 { redirectUrl, transactionId }.
  const data = (await response.json()) as {
    redirectUrl?: string;
    link?: string;
    transactionId?: string;
    chargeId?: string;
  };
  const redirectUrl = data.redirectUrl ?? data.link;
  if (!redirectUrl) throw new Error("Bictorys charge returned no redirect URL");
  return { transactionId: data.transactionId ?? data.chargeId ?? null, redirectUrl };
}

/**
 * The transaction's status, or `null` when it cannot be read. The response
 * shape `{ status }` is an assumption until a sandbox response confirms it.
 */
export async function getTransactionStatus(transactionId: string): Promise<string | null> {
  try {
    const { baseUrl, apiKey } = config();
    const response = await fetch(`${baseUrl}/pay/v1/transactions/${encodeURIComponent(transactionId)}/status`, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { status?: unknown };
    return typeof data.status === "string" ? data.status : null;
  } catch (error) {
    console.error("[bictorys] transaction status check failed:", error);
    return null;
  }
}

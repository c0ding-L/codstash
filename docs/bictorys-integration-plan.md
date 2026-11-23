# Bictorys Integration Plan — Cortex Pro

> Source prompt: `context/research/bictorys-integration-research.md`. Researched 2026-11-22.
> Replaces the Stripe plan: Stripe is not available in the author's country.
>
> Facts marked **[doc]** come from docs.bictorys.com; **[code]** from this repo; **[assumption]**
> are inferences to confirm. Bictorys docs are partly inconsistent (see §10), so every
> **[assumption]** must be checked in the sandbox before going live.

---

## 1. Summary and recommendation

- **Billing model: one-off payments that extend a `proUntil` date** (option 2). Each checkout
  pays for 1 month or 1 year; Pro is active while `proUntil > now`. No automatic renewal.
- Native Bictorys subscriptions are **not** a good fit today (§3): they only send the customer a
  payment link at each due date (no automatic debit), have no yearly cadence, and their webhook
  events are not documented.
- Payment goes through the **Bictorys hosted checkout** (`POST /pay/v1/charges` without
  `payment_type`), which offers card and Mobile Money (Wave, Orange Money…).
- The **webhook is the only source of truth** for granting Pro. The success redirect only shows a
  "confirming payment" state, with a server-side status check as fallback.
- **Three currencies: USD, EUR, XOF**, with prices set by hand per currency (§2). The user picks
  the currency at checkout. USD and EUR are card-only; XOF adds Mobile Money (sandbox-verified).

---

## 2. Currencies and prices

Cortex is an international SaaS, so checkout supports **USD, EUR and XOF**.

### 2.1 What Bictorys accepts — sandbox-verified 2026-11-22

Three hosted-checkout charges were created with the sandbox public key and the checkout pages
opened in a headless browser:

| Request                         | Response | Checkout page shows | Payment methods offered                         |
| ------------------------------- | -------- | ------------------- | ----------------------------------------------- |
| `amount: 4000, currency: "XOF"` | 202      | "CFA 4000"          | Bank card + Mobile Payment (SEN, CIV, BEN, BFA, MLI, TGO; Wave, MaxIt…) |
| `amount: 7, currency: "EUR"`    | 202      | "€ 7"               | **Bank card only** (`payment_category=card` added to the link) |
| `amount: 7, currency: "USD"`    | 202      | "$ 7"               | **Bank card only** (`payment_category=card` added to the link) |

- `amount` is in **major units** (7 = €7, not cents). Keep prices whole numbers.
- The docs list no currencies and say XOF is the default; EUR/USD acceptance comes from the
  sandbox only. The merchant balance is in XOF by default, so EUR/USD payments are presumably
  converted — rate and FX fees undocumented (§10).
- Cards: the docs say "most credit and debit card schemes" and show `visa_card` /
  `mastercard_card`. The author accepts that foreign Visa/Mastercard cards will work; confirm with
  one real payment after going live.
- The merchant's display name and contact e-mail appear on the checkout page — set a business
  name in the dashboard before going live.

### 2.2 Prices — set by hand, no live conversion

> **Superseded 2026-11-23:** EUR/USD card payments are assumed unsupported, so EUR/USD prices are
> shown as is but **charged in XOF**: EUR at the fixed parity, USD via the ECB rate (Frankfurter).
> See `chargeFor` in `src/lib/exchange-rates.ts` and `CHARGED_DIRECTLY` in `billing-plans.ts`.



**[code]** The site shows **$7/month** and **$63/year** (`src/components/home/PricingPlans.tsx:90`,
`context/project-overview.md:225`); yearly is 25 % off 12 × monthly.

| Plan    | USD  | EUR  | XOF      |
| ------- | ---- | ---- | -------- |
| Monthly | $7   | €7   | 4 000    |
| Yearly  | $63  | €63  | 36 000   |

- XOF is pegged to EUR (1 € = 655.957 XOF), so XOF is set from EUR and rounded to a local
  price; USD is set by hand. No FX API, no rounding surprises.
- All amounts live in one constant (`BILLING_PLANS` in `src/lib/billing-plans.ts`, §7.2), so changing a price is one edit.
- The pricing page gets a currency switch (display only). The chosen currency is sent to
  checkout; nothing is stored on the user.
- Mobile Money is shown as "XOF only (West Africa)" next to the switch.

---

## 3. Billing model decision

### Option 1 — Native Bictorys subscriptions (Billing API) — not recommended

**[doc]** `POST {base}/billing/v1/subscription-plans` (`amount`, `currency`, `name`,
`nbrInstallments`, `installmentIntervalDays` default 30, `customerMessage`) then
`POST {base}/billing/v1/subscriptions` (`subscriptionPlanId`, `startDate`, `customerId`,
`notificationChannel`: email | sms | whatsApp | none). Cancel: `POST /subscriptions/{id}/cancel`.
Statuses `opened | started | cancelled | completed`.

Problems:

- **No automatic debit [doc]**: at each due date Bictorys *sends a payment link* to the customer
  (email/SMS/WhatsApp). The customer pays manually anyway.
- **No yearly plan [doc]**: only `installmentIntervalDays`. A yearly plan would be a 365-day
  interval — undocumented, and the docs contradict themselves ("one month" vs 30 days).
- **No documented webhook for installments [doc]**: the webhook page is a stub; the known payload
  has `type: "payment"` and a `paymentReference`, but nothing ties an installment payment to a
  subscription in the docs. We could not reliably know which user paid.
- Requires a Bictorys `customerId` (customer-management API) per user, and plan objects to keep in
  sync with our prices.
- Charging a saved card (`tokenizedCardObject: { cardId, cvv }`) needs the CVV, so it is
  customer-present, not merchant-initiated **[doc]**.

### Option 2 — One-off charges + `proUntil` — recommended

- Checkout for "1 month" or "1 year". On a succeeded webhook, `proUntil = max(now, proUntil) + 30
  or 365 days`. Paying early stacks time; no time is lost.
- Pro status is a single derived check: `proUntil !== null && proUntil > now`.
- "Cancel" does not exist: the user simply does not renew, and Pro ends at `proUntil`.
- Renewal = a new checkout from Settings (a "Renew" button appears; an expiry reminder e-mail via
  Resend can be added later — out of scope here).
- We fully control the `paymentReference`, so every webhook maps to exactly one `Payment` row.

The rest of this plan implements option 2.

---

## 4. Current state analysis

### 4.1 User model **[code]** `prisma/schema.prisma`

```prisma
isPro                Boolean @default(false)
stripeCustomerId     String?
stripeSubscriptionId String?
```

- `isPro` is **not read anywhere** in `src/` — no feature is gated yet. Only `prisma/seed.ts:320`
  sets it (`isPro: false`).
- `stripeCustomerId` / `stripeSubscriptionId` are unused.
- Prisma 7 with the `prisma-client` generator, output `src/generated/prisma`, Neon adapter
  (`src/lib/prisma.ts`).

### 4.2 Auth / session **[code]**

- `src/auth.ts`: NextAuth v5, JWT strategy, Prisma adapter, GitHub + Credentials.
- The `jwt` callback **already queries the user on every request** (to check
  `passwordChangedAt`). Pro status can be added to that same `select` — **no extra query**, which
  is better than the workaround in the research prompt.
- `session` callback copies only `token.id`. Types in `src/types/next-auth.d.ts`
  (`Session.user.id`, `JWT.id`, `JWT.authTime`).
- `src/proxy.ts` protects `/dashboard`, `/favorites`, `/profile`, `/settings`, `/items`,
  `/collections`. `/api/*` is outside the matcher, so a webhook route is public by default
  (routes check the session themselves, like `/api/upload`).
- **No client component uses `useSession`/`SessionProvider`.** Pages are server-rendered and call
  `auth()` + `src/lib/db/*` helpers. So a webhook update is visible on the next request / reload
  without any session refresh trick.

### 4.3 Data access patterns **[code]**

- Server actions in `src/actions/*.ts` (`"use server"`): Zod parse → `auth()` → query helper from
  `src/lib/db/*` → return `{ success, data, error }` (items/collections) or `{ success, error }`
  (profile). Errors are logged with a `[module]` prefix and returned as friendly messages.
- Rate limits: `src/lib/rate-limit.ts` (`LIMITS` map, Upstash, fails open, `tooManyAttemptsMessage`
  / `tooManyAttemptsResponse`).
- Route handlers: `src/app/api/**/route.ts` returning `NextResponse.json({ error }, { status })`.
- `APP_URL` is already used to build absolute links (`src/lib/password-reset.ts:26`,
  `src/app/api/auth/register/route.ts:32`).

### 4.4 Existing payment code **[code]**

None. Stripe leftovers to remove:

- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY` in `.env`, `.env.example`,
  `.env.production` (all empty).
- `stripeCustomerId`, `stripeSubscriptionId` columns.
- "Stripe for subscriptions + webhooks for syncing" in `context/project-overview.md:227`, and the
  `stripe*` fields in its schema listing (`:113-115`).

### 4.5 Environment **[code]**

`BICTORYS_API_URL` (sandbox URL), `BICTORYS_API_KEY` (test public key), `BICTORYS_PRIVATE_KEY`
(test secret key), `BICTORYS_WEBHOOK_SECRET` are set in `.env` and `.env.production`.
`BICTORYS_MERCHANT_SECRET_CODE` is empty — only needed for payouts, not used here.
Only `BICTORYS_API_URL`, `BICTORYS_API_KEY` and `BICTORYS_WEBHOOK_SECRET` are needed.

---

## 5. Feature gating analysis

### 5.1 What exists **[code]**

| Feature                        | Exists? | Where to gate                                                   |
| ------------------------------ | ------- | --------------------------------------------------------------- |
| Item limit (50 for Free)       | yes     | `createItem` — `src/actions/items.ts:220`                       |
| Collection limit (3 for Free)  | yes     | `createCollection` — `src/actions/collections.ts:81`            |
| File & image uploads (Pro)     | yes     | `POST /api/upload` (`src/app/api/upload/route.ts`) **and** `createItem` for `type: "file" \| "image"` |
| Custom item types (Pro)        | no      | gate when built                                                 |
| AI features (Pro)              | no      | gate when built                                                 |
| Export (Pro)                   | no      | gate when built                                                 |

`src/lib/db/limits.ts` holds *list* ceilings (`MAX_ITEM_LIMIT` etc.), not plan limits — keep them
separate.

### 5.2 Rules

- One helper decides Pro: `isProActive(proUntil, now)` in `src/lib/billing-plans.ts`. Nothing else
  compares dates.
- Limits are checked **in the server action / route**, never only in the UI.
- Counting before create is a small race (two parallel creates at 49). Acceptable for a soft
  limit; no transaction needed.
- Existing Free users above the limits keep their data; they just cannot create more.
- When Pro expires, data stays; only new creation above limits and uploads are blocked.
- The demo user (`DEMO_USER_EMAIL`) stays Free unless the author decides otherwise.

### 5.3 UI touchpoints

- **Settings** (`src/app/(app)/settings/page.tsx`): add a **"Plan"** section above "Editor":
  current plan, `Pro until <date>` or `Free — X/50 items, Y/3 collections`, and buttons
  "Upgrade — monthly / yearly" or "Extend". Settings sections are `<section>` + `<Card>`.
- **Pricing** (`PricingPlans.tsx:102`): "Get Pro" links to `/register`. For a signed-in user it
  should go to `/settings#plan`. Minimal change: link to `/settings#plan` — the proxy sends signed-
  out visitors to sign-in with `callbackUrl`.
- Error messages from gated actions say what to do: "Free accounts can have 50 items. Upgrade to
  Pro in Settings."

---

## 6. Bictorys API reference (what we use)

| Purpose          | Call                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Create checkout  | `POST {BICTORYS_API_URL}/pay/v1/charges` — header `X-Api-Key: <public key>` |
| Status fallback  | `GET {BICTORYS_API_URL}/pay/v1/transactions/{transactionId}/status`  |
| Webhook (in)     | `POST {APP_URL}/api/webhooks/bictorys` — header `X-Secret-Key`        |

Charge request **[doc]**:

```json
{
  "amount": 4000,
  "currency": "XOF",            // or "EUR" / "USD" — see §2
  "paymentReference": "cortex_<payment id>",
  "merchantReference": "<user id>",
  "successRedirectUrl": "https://<APP_URL>/settings/billing?ref=cortex_<id>",
  "errorRedirectUrl": "https://<APP_URL>/settings/billing?ref=cortex_<id>&error=1",
  "customerObject": { "name": "...", "email": "..." },
  "orderDetails": [{ "name": "Cortex Pro — 1 month", "price": 4000, "quantity": 1 }]
}
```

- **Sandbox-verified**: hosted checkout (no `payment_type`) returns **`202`**
  `{ "type": "CheckoutLinkObject", "link", "chargeId", "opToken" }` — no `redirectUrl`, no
  `transactionId`. The `201` shape with `transactionId` / `redirectUrl` **[doc]** is for direct
  charges with a `payment_type`. Handle both: `redirectUrl ?? link`, `transactionId ?? chargeId`.
- Whether `chargeId` works with the status endpoint, and whether the webhook `id` equals it, is
  unknown — log the first sandbox webhook and adjust. The webhook is matched by
  `paymentReference` anyway, so this only affects the status fallback.
- Error-URL casing: the guide shows `ErrorRedirectUrl`, the schema `errorRedirectUrl`
  **[doc conflict]**. The sandbox probe sent lowercase `errorRedirectUrl` and got a 202, so the
  call is accepted — but the error redirect itself is still untested.
- Bictorys does **not** document query params on the redirect, so we put our own `ref` in the URL.
- Redirect URLs may need `https://` **[assumption]** (an error code requires it for
  subscriptions) — in dev, use the tunnel URL as `APP_URL` (§8).

Webhook payload (relevant fields) **[doc]**: `id`, `type`, `amount`, `currency`,
`paymentReference`, `merchantReference`, `status`, `pspName`, `timestamp`. Paid statuses:
`succeeded`, `authorized`. Others: `pending`, `processing`, `failed`, `cancelled`, `reversed`.
**[doc conflict]** The validation page says `amount` includes customer fees; the
transaction-details page says `amount` is what the merchant receives, *net of fees*. The amount
check is therefore decided from a captured sandbox webhook (§7.5, §11 step 4), not from the docs.

Authenticity **[doc]**: compare `X-Secret-Key` with `BICTORYS_WEBHOOK_SECRET` (constant-time).
The guide also mentions `X-Webhook-Signature` (HMAC-SHA256 of `${timestamp}.${rawBody}`) and
`X-Webhook-Timestamp` — not on the official validation page, so **verify it only when present**.
Retries: up to 3 times when the response is not 200.

---

## 7. Implementation

### 7.1 Schema — `prisma/schema.prisma` (modify)

```prisma
model User {
  // ...
  // Kept (author's decision). Mirror of `proUntil`: set true when a payment succeeds,
  // set back to false when the expiry is noticed. `proUntil` stays the source of truth.
  isPro    Boolean   @default(false)
  // Pro is active while this is in the future. Null: never paid.
  proUntil DateTime?
  payments Payment[]
  // removed: stripeCustomerId, stripeSubscriptionId
}

enum BillingPlan {
  MONTHLY
  YEARLY
}

enum Currency {
  USD
  EUR
  XOF
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  NEEDS_REVIEW // paid at Bictorys, but amount/currency did not match — fixed by hand
}

/// One Bictorys checkout. `reference` is the `paymentReference` sent to Bictorys,
/// so every webhook maps to exactly one row.
model Payment {
  id            String        @id @default(cuid())
  reference     String        @unique
  // Null once the account is deleted: payment rows are kept (author's decision).
  userId        String?
  user          User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  plan          BillingPlan
  amount        Int           // major units, as sent to Bictorys
  currency      Currency
  status        PaymentStatus @default(PENDING)
  transactionId String?       @unique
  paidAt        DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([userId, createdAt])
}
```

- **`isPro` is kept** (decided). Rules so it never contradicts `proUntil`:
  - every gate and the session use `isProActive(proUntil)` — never `isPro` alone;
  - `markPaymentSucceeded` writes `isPro: true` together with the new `proUntil`;
  - the `jwt` callback (which already reads the user each request) resets it lazily: if
    `isPro && !isProActive(proUntil)` → `updateMany({ where: { id, isPro: true }, data: { isPro: false } })`.
    One write per expiry, not per request.
  - `isPro` is therefore a readable flag for the DB / future admin views, not a gate.
- **Payments are kept when an account is deleted** (decided): `userId` optional,
  `onDelete: SetNull`. The Bictorys dashboard keeps the customer details of each transaction.
  A webhook for a payment whose user is gone marks the payment and skips the user update.
- Migration: `npx prisma migrate dev --name bictorys_billing` (never `db push`), then
  `prisma generate` and **restart the dev server** (it keeps the old client).

### 7.2 `src/lib/billing-plans.ts` (create) — pure, client-safe, unit-tested

Imported by client components (`PricingPlans.tsx`, `UpgradeButtons.tsx`), so it must not import
anything Node-only (`node:crypto`, Prisma). Webhook verification lives in the server-only
`billing-webhook.ts` (§7.5).

```ts
export const CURRENCIES = ["USD", "EUR", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Prices in major units, set by hand per currency (no live conversion). */
export const BILLING_PLANS = {
  MONTHLY: { days: 30, label: "Cortex Pro — 1 month", price: { USD: 7, EUR: 7, XOF: 4_000 } },
  YEARLY: { days: 365, label: "Cortex Pro — 1 year", price: { USD: 63, EUR: 63, XOF: 36_000 } },
} as const;

export const DEFAULT_CURRENCY: Currency = "USD";

/**
 * "$7", "€7", "4 000 FCFA". XOF is formatted by hand: Intl's XOF output ("F CFA 4,000")
 * is not how prices are written locally.
 */
export function formatPrice(amount: number, currency: Currency) {
  if (currency === "XOF") return `${amount.toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export const FREE_LIMITS = { items: 50, collections: 3 } as const;

const DAY_MS = 86_400_000;

/** The only place that decides whether a user is Pro. */
export function isProActive(proUntil: Date | null | undefined, now = new Date()) {
  return proUntil != null && proUntil.getTime() > now.getTime();
}

/** Paying early stacks on the remaining time; paying after expiry starts from now. */
export function extendProUntil(current: Date | null, days: number, now = new Date()) {
  const start = current && current > now ? current : now;
  return new Date(start.getTime() + days * DAY_MS);
}
```

### 7.2b Webhook verification — in `src/lib/billing-webhook.ts` (server-only)

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const PAID_STATUSES = new Set(["succeeded", "authorized"]);
export const FAILED_STATUSES = new Set(["failed", "cancelled"]);

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * X-Secret-Key is required. The HMAC headers are only in Bictorys's guide, not on
 * the validation page, so they are checked when present and never required.
 */
export function verifyWebhook(headers: Headers, rawBody: string, secret: string, now = Date.now()) {
  if (!secret) return false;
  const key = headers.get("x-secret-key");
  if (!key || !safeEqual(key, secret)) return false;

  const signature = headers.get("x-webhook-signature");
  const timestamp = headers.get("x-webhook-timestamp");
  if (signature && timestamp) {
    if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) return false;
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    if (!safeEqual(signature, expected)) return false;
  }
  return true;
}
```

Plus a Zod schema for the webhook payload (`paymentReference: string`, `status: string`,
`amount: number`, `currency: string`, `id?: string`, `.passthrough()` — unknown fields ignored).

### 7.3 `src/lib/bictorys.ts` (create) — thin HTTP client

```ts
const TIMEOUT_MS = 15_000;

function config() {
  const baseUrl = process.env.BICTORYS_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.BICTORYS_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BICTORYS_API_URL / BICTORYS_API_KEY are not set");
  return { baseUrl, apiKey };
}

export interface CreateChargeInput {
  amount: number;
  currency: "USD" | "EUR" | "XOF";
  reference: string;
  merchantReference: string;
  label: string;
  successUrl: string;
  errorUrl: string;
  customer: { name?: string | null; email: string };
}

export async function createCharge(input: CreateChargeInput) {
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
    // Body may be HTML (WAF 403) — log the status and a bounded excerpt only.
    throw new Error(`Bictorys charge failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  // Hosted checkout answers 202 { type: "CheckoutLinkObject", link, chargeId, opToken } (sandbox-verified).
  const data = (await response.json()) as { transactionId?: string; redirectUrl?: string; link?: string; chargeId?: string };
  const redirectUrl = data.redirectUrl ?? data.link;
  if (!redirectUrl) throw new Error("Bictorys charge returned no redirect URL");
  return { transactionId: data.transactionId ?? data.chargeId ?? null, redirectUrl };
}

export async function getTransactionStatus(transactionId: string): Promise<string | null> {
  const { baseUrl, apiKey } = config();
  const response = await fetch(`${baseUrl}/pay/v1/transactions/${encodeURIComponent(transactionId)}/status`, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { status?: string };
  return data.status ?? null;
}
```

Response field names for the status endpoint are **[assumption]** — log the first sandbox response
and adjust.

### 7.4 `src/lib/db/billing.ts` (create)

```ts
export async function getPlanStatus(userId: string) {
  const [user, items, collections] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { proUntil: true } }),
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
  ]);
  return { proUntil: user?.proUntil ?? null, isPro: isProActive(user?.proUntil), items, collections };
}

/** amount = BILLING_PLANS[plan].price[currency]; reference = `cortex_${cuid}`. */
export function createPendingPayment(userId: string, plan: BillingPlan, currency: Currency) { /* ... */ }
export function setPaymentTransactionId(paymentId: string, transactionId: string) { /* ... */ }

/**
 * Idempotent: only a PENDING row moves to SUCCEEDED, so a retried webhook (or the
 * webhook racing the status fallback) extends Pro once.
 */
export async function markPaymentSucceeded(reference: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { reference }, include: { user: { select: { proUntil: true } } } });
    if (!payment || payment.status !== "PENDING") return { applied: false as const };
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCEEDED", paidAt: now },
    });
    if (claimed.count === 0) return { applied: false as const };
    // Account deleted since checkout: the payment is recorded, there is no one to upgrade.
    if (!payment.userId || !payment.user) return { applied: true as const, proUntil: null };
    const proUntil = extendProUntil(payment.user.proUntil, BILLING_PLANS[payment.plan].days, now);
    await tx.user.update({ where: { id: payment.userId }, data: { proUntil, isPro: true } });
    return { applied: true as const, proUntil };
  });
}

export function markPaymentFailed(reference: string) {
  return prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
}
```

`src/lib/prisma.ts` uses `PrismaNeon` (WebSocket driver), which supports interactive
`$transaction` — unlike `PrismaNeonHttp`. No code in `src/` uses `$transaction` yet, so verify it
once in the develop DB. Even without the transaction, the `updateMany` "claim" on
`status: PENDING` makes a retried webhook a no-op.

### 7.5 `src/lib/billing-webhook.ts` (create) — testable, server-only

The route file is not covered by Vitest (`include` is `src/actions/**` and `src/lib/**`), so the
logic lives here and the route stays a thin wrapper. Also holds `verifyWebhook` (§7.2b) and the
Zod payload schema. Never imported by a client component.

**One confirm path.** The webhook and the return-page fallback (`refreshPaymentStatus`, §7.7)
both go through `applyPaymentStatus`, so the same checks apply whichever arrives first:

```ts
export interface ReportedPayment {
  status: string;
  amount?: number;      // absent from the status endpoint → amount check skipped there, see below
  currency?: string;
}

/** Shared by the webhook and the status fallback. Idempotent. */
export async function applyPaymentStatus(reference: string, reported: ReportedPayment) {
  const payment = await findPaymentByReference(reference);
  if (!payment || payment.status !== "PENDING") return payment?.status ?? null;

  if (PAID_STATUSES.has(reported.status)) {
    const mismatch =
      (reported.currency !== undefined && reported.currency !== payment.currency) ||
      (reported.amount !== undefined && !amountMatches(reported.amount, payment.amount));
    if (mismatch) {
      // Paid at Bictorys but not what we expected: never silently drop it.
      await markPaymentNeedsReview(reference, reported);
      console.error("[billing] payment needs review", { reference, ...reported });
      return "NEEDS_REVIEW";
    }
    await markPaymentSucceeded(reference);
    return "SUCCEEDED";
  }
  if (FAILED_STATUSES.has(reported.status)) {
    await markPaymentFailed(reference);
    return "FAILED";
  }
  return "PENDING"; // pending / processing; `reversed`: log for manual handling (§10)
}

export async function handleBictorysWebhook(headers: Headers, rawBody: string): Promise<{ status: number }> {
  if (!verifyWebhook(headers, rawBody, process.env.BICTORYS_WEBHOOK_SECRET ?? "")) return { status: 401 };

  let json: unknown;
  try { json = JSON.parse(rawBody); } catch { return { status: 400 }; }
  const parsed = webhookPayloadSchema.safeParse(json);
  if (!parsed.success) return { status: 200 };           // not a payment event we know: ack and ignore

  const { paymentReference, status, amount, currency } = parsed.data;
  await applyPaymentStatus(paymentReference, { status, amount, currency });
  return { status: 200 };
}
```

- `amountMatches` is **decided from a captured sandbox webhook** (§11 step 4), not guessed: the
  docs disagree on whether `amount` includes customer fees (validation page) or is net of fees
  (transaction-details page). Compare against what we charged — never a converted amount.
- A mismatch sets the payment to `NEEDS_REVIEW` (add it to the `PaymentStatus` enum): the user is
  not granted Pro automatically, but the row is visible and can be fixed by hand (grant Pro on
  the develop/production DB after checking the Bictorys dashboard). The return page shows
  "We received your payment and are checking it — contact support if this takes long."
- The status endpoint may not return amount/currency; if so, the fallback cannot check them.
  Decide after seeing its real response (§10 q4): either the fallback only *displays* the status
  and leaves granting to the webhook, or it grants with the status alone. Default: **display
  only** — safest until verified.

A thrown DB error propagates → route returns 500 → Bictorys retries (3 times). Everything handled
returns 200.

### 7.6 `src/app/api/webhooks/bictorys/route.ts` (create)

```ts
import { NextResponse } from "next/server";
import { handleBictorysWebhook } from "@/lib/billing-webhook";

/** Public (outside the proxy matcher); authenticated by the shared secret instead of a session. */
export async function POST(request: Request) {
  const rawBody = await request.text();               // raw text, for the optional HMAC
  try {
    const { status } = await handleBictorysWebhook(request.headers, rawBody);
    return new NextResponse(null, { status });
  } catch (error) {
    console.error("[billing] webhook failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
```

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before
writing it (Next 16). Route handlers with `POST` are dynamic; no caching config needed.

### 7.7 `src/actions/billing.ts` (create)

```ts
"use server";

export type CheckoutResult = { success: true; redirectUrl: string; error: null } | { success: false; redirectUrl: null; error: string };

const checkoutSchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"], { error: "Choose a plan." }),
  currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
});

export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, redirectUrl: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { plan, currency } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, redirectUrl: null, error: "You are not signed in." };

    const limit = await checkRateLimit("checkout", session.user.id);
    if (!limit.success) return { success: false, redirectUrl: null, error: tooManyAttemptsMessage(limit.reset) };

    const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
    if (!appUrl) { console.error("[billing] APP_URL is not set."); return { /* generic error */ }; }

    const user = await getProfile(session.user.id);        // name + email for customerObject
    if (!user) return { success: false, redirectUrl: null, error: "This account no longer exists." };

    // Amount always comes from the server-side price table, never from the client.
    const payment = await createPendingPayment(user.id, plan, currency);
    const back = `${appUrl}/settings/billing?ref=${encodeURIComponent(payment.reference)}`;
    const charge = await createCharge({
      amount: payment.amount,
      currency,
      reference: payment.reference,
      merchantReference: user.id,
      label: BILLING_PLANS[plan].label,
      successUrl: back,
      errorUrl: `${back}&error=1`,
      customer: { name: user.name, email: user.email },
    });
    if (charge.transactionId) await setPaymentTransactionId(payment.id, charge.transactionId);
    return { success: true, redirectUrl: charge.redirectUrl, error: null };
  } catch (error) {
    console.error("[billing] startCheckout failed:", error);
    return { success: false, redirectUrl: null, error: "Could not start the payment. Try again." };
  }
}

/**
 * Fallback for the return page when the webhook is late: asks Bictorys for the
 * status of the user's own pending payment and applies it through the same
 * idempotent path as the webhook.
 */
export async function refreshPaymentStatus(reference: string): Promise<{ status: PaymentStatus }> {
  /* owner check → getTransactionStatus(payment.transactionId) → applyPaymentStatus(reference, …)
     (or display only, see §7.5) → return the row's status */
}
```

The client then does `window.location.assign(result.redirectUrl)` — `redirect()` from a server
action cannot target an external URL reliably from a client-called action, and returning the URL
keeps the existing `{ success, error }` result shape. Do not start a checkout for a Pro user with
more than a year left — **optional guard, decision**.

`src/lib/rate-limit.ts` (modify): add `checkout: { attempts: 5, window: "15 m" }` to `LIMITS`.

### 7.8 Return page — `src/app/(app)/settings/billing/page.tsx` (create)

- Under `/settings`, so the proxy already guards it.
- Reads `ref` and `error` from `searchParams` (async in Next 16 — check the page docs), loads the
  payment **for the current user only**.
- SUCCEEDED → "You're Pro until <date>". PENDING → "Confirming your payment…" with a client leaf
  that calls `refreshPaymentStatus(ref)` a few times (e.g. every 3 s, max ~10 tries) then
  `router.refresh()`. FAILED / `error=1` → "The payment did not go through" + retry button.
- Never grants Pro by itself; the status always comes from the DB / Bictorys.
- Same page conventions as the others: `await connection()`, async server component, client leaves
  only.

### 7.9 Auth — `src/auth.ts` and `src/types/next-auth.d.ts` (modify)

The `jwt` callback already reads the user on every request; add `proUntil` to that select:

```ts
const account = await prisma.user.findUnique({
  where: { id: token.id },
  select: { passwordChangedAt: true, proUntil: true, isPro: true },
});
if (!account) return null;
if (account.passwordChangedAt && account.passwordChangedAt.getTime() > (token.authTime ?? 0)) return null;
token.isPro = isProActive(account.proUntil);
// Keep the stored flag in step with the expiry: one write when Pro lapses.
if (account.isPro && !token.isPro) {
  await prisma.user.updateMany({ where: { id: token.id, isPro: true }, data: { isPro: false } });
}
return token;
```

and on sign-in (`if (user?.id)` branch) leave `isPro` unset — the next request fills it. In
`session`: `session.user.isPro = token.isPro ?? false;`. Types: `Session.user.isPro: boolean`,
`JWT.isPro?: boolean`.

This replaces the `trigger === "update"` approach and the extra query of the research prompt's
workaround. It is convenient for UI (badge, nav), but **server-side gating should still read
`proUntil` from the DB** (`getPlanStatus`) at the moment of the check — the token is one request
old.

### 7.10 Gating — modify

- `src/actions/items.ts` `createItem`: after auth, `const plan = await getPlanStatus(userId)`.
  If `!plan.isPro && plan.items >= FREE_LIMITS.items` → error "Free accounts can have 50 items.
  Upgrade to Pro in Settings.". If type is `file`/`image` and not Pro → "File and image uploads
  are a Pro feature." (and delete the uploaded object, like the existing cleanup path).
- `src/actions/collections.ts` `createCollection`: same with `FREE_LIMITS.collections`.
- `src/app/api/upload/route.ts`: after the session check and before reading the body, reject
  non-Pro with `403 { error: "File and image uploads are a Pro feature." }`, so free users cannot
  fill R2.
- UI: hide or disable the File/Image types in the New Item dialog for Free users (prop from the
  server, not `useSession`).

Changing these gates existing behaviour (uploads become Pro-only). Existing free-user tests in
`items.test.ts` / `collections.test.ts` must mock `getPlanStatus` (or `prisma.user.findUnique` +
counts).

### 7.11 Settings — modify `src/app/(app)/settings/page.tsx`

Add a "Plan" section (id `plan`) first, using `getPlanStatus(profile.id)`; new client component
`src/components/settings/UpgradeButtons.tsx` with a currency switch (USD / EUR / XOF, initial
value from `?currency=` when coming from the pricing page, else `DEFAULT_CURRENCY`), the prices
from `BILLING_PLANS` via `formatPrice`, a note "Card only" for USD/EUR and "Card or Mobile Money"
for XOF, and buttons calling `startCheckout({ plan, currency })`; pending state while
redirecting, and the action's error message. Update the page description ("Manage your plan, your editor…").

### 7.12 Other modifications

- `src/components/home/PricingPlans.tsx`: add a USD / EUR / XOF switch next to the existing
  monthly / yearly switch (it is already a client component with `billing` state), read prices
  from `BILLING_PLANS` instead of the hard-coded `$7` / `$63` / `$5.25`, and point "Get Pro" to
  `/settings?currency=<chosen>#plan`. Display only — nothing is stored.
- `prisma/seed.ts:320`: no change needed — `isPro: false` stays valid and `proUntil` defaults to
  null. Check it does not reference the dropped `stripe*` fields.
- `.env.example`: remove `STRIPE_*`, add
  `BICTORYS_API_URL=`, `BICTORYS_API_KEY=`, `BICTORYS_WEBHOOK_SECRET=`.
  Remove `STRIPE_*` from `.env` / `.env.production` too (author's files).
- `vitest.config.mts`: blank `BICTORYS_API_URL`, `BICTORYS_API_KEY`, `BICTORYS_PRIVATE_KEY`,
  `BICTORYS_WEBHOOK_SECRET` in `test.env`.
- `context/project-overview.md`: replace the Stripe line with Bictorys (one-off XOF payments,
  `proUntil`), update the User schema listing, add `Payment`.

### 7.13 Files summary

| Action  | File |
| ------- | ---- |
| create  | `src/lib/billing-plans.ts` (+ `billing-plans.test.ts`) — client-safe |
| create  | `src/lib/bictorys.ts` (+ `bictorys.test.ts`) |
| create  | `src/lib/db/billing.ts` (+ `billing.test.ts`) |
| create  | `src/lib/billing-webhook.ts` (+ `billing-webhook.test.ts`) — server-only: `verifyWebhook`, `applyPaymentStatus`, handler |
| create  | `src/app/api/webhooks/bictorys/route.ts` |
| create  | `src/actions/billing.ts` (+ `billing.test.ts`) |
| create  | `src/app/(app)/settings/billing/page.tsx` + a client leaf for polling |
| create  | `src/components/settings/UpgradeButtons.tsx` (or `PlanCard.tsx`) |
| create  | migration `prisma/migrations/<ts>_bictorys_billing/` |
| modify  | `prisma/schema.prisma`, `prisma/seed.ts` |
| modify  | `src/auth.ts`, `src/types/next-auth.d.ts` |
| modify  | `src/actions/items.ts`, `src/actions/collections.ts`, `src/app/api/upload/route.ts` (+ tests) |
| modify  | `src/lib/rate-limit.ts` |
| modify  | `src/app/(app)/settings/page.tsx`, `src/components/home/PricingPlans.tsx`, New Item dialog |
| modify  | `.env.example`, `vitest.config.mts`, `context/project-overview.md` |

---

## 8. Bictorys dashboard setup and local testing

1. **Sandbox keys**: already in `.env` (`test_public-…`, `test_secret-…`, sandbox URL).
2. **Tunnel** for local webhooks and https redirects: e.g. `cloudflared tunnel --url
   http://localhost:3000` or `ngrok http 3000`. Put the tunnel URL in `APP_URL` while testing
   payments (redirect URLs are built from it). Restart `npm run dev` after changing `.env`.
3. **Webhook (test environment)**: Dashboard → Developers → Webhooks → URL
   `https://<tunnel>/api/webhooks/bictorys`. Copy the secret into `BICTORYS_WEBHOOK_SECRET`
   (test and live webhooks are configured separately).
4. **Payment methods**: check which methods are active on the account (dashboard, or
   `GET {BICTORYS_API_URL}/onboarding/v1/payment-methods/me` with the private key).
5. **Customer fees**: decide in the dashboard whether the merchant or the customer pays fees (it
   changes the webhook `amount`). Set it **before** capturing the reference webhook (§11 step 4).
6. **Go live** (later): live keys + `BICTORYS_API_URL=https://api.bictorys.com`, a live webhook on
   the production URL with its own secret, set in Vercel env. Production DB migration is applied
   by the author, not through the Neon MCP.

---

## 9. Testing checklist

### Unit tests (Vitest, mocks only — no real Bictorys / DB)

- `billing-plans.test.ts`: every plan has a whole, positive price in every currency (XOF ≥ 100);
  `formatPrice` ("$7", "€7", "4 000 FCFA"); `isProActive` (null, past, future, exactly now),
  `extendProUntil` (null, expired → from now, active → stacks).
- `bictorys.test.ts` (stub `fetch` with `vi.stubGlobal`): request URL, `X-Api-Key` header, body
  fields; `redirectUrl` vs `link` fallback; non-2xx throws with status; missing env throws.
- `db/billing.test.ts`: `markPaymentSucceeded` applies once (PENDING → SUCCEEDED, extends
  `proUntil`), second call no-op, unknown reference no-op; `markPaymentFailed` only touches
  PENDING.
- `billing-webhook.test.ts`: `verifyWebhook` (missing key, wrong key, wrong length, good key,
  good/bad HMAC, stale timestamp, HMAC absent → key alone accepted, empty secret → false);
  `applyPaymentStatus`: `succeeded` / `authorized` grant; wrong currency / amount → `NEEDS_REVIEW`,
  no Pro; `failed` marks failed; `pending` changes nothing; non-PENDING row untouched; handler:
  401 bad secret; 400 bad JSON; 200 for unknown reference; DB error throws (→ 500). Use the
  captured sandbox payload as the fixture.
- `actions/billing.test.ts`: invalid plan; invalid currency; amount taken from the price table
  for each currency (a client-sent amount is ignored); signed out; rate limited; missing `APP_URL`; creates
  pending payment, calls `createCharge` with the right amount/URLs, stores `transactionId`,
  returns `redirectUrl`; Bictorys error → friendly error. `refreshPaymentStatus`: other user's
  reference refused; goes through `applyPaymentStatus` (or display only, per §7.5).
- Gating in `items.test.ts` / `collections.test.ts`: Free at 49 → ok, at 50 → refused, Pro at 50
  → ok; file/image refused for Free.

Remember: `mockReset` is on — set return values in tests or `beforeEach`. Run through Windows npm:
`cmd.exe /c "E: && cd \PROGRAMMING\CODE\codstash && npm test"`.

### Manual sandbox tests (through the tunnel)

| Scenario                                    | How                                         | Expected |
| ------------------------------------------- | ------------------------------------------- | -------- |
| Monthly card success, frictionless          | card `2303 7799 9900 0275`, `12/30`, CVV any | redirect to `/settings/billing` → Pro until now + 30 d |
| Each currency (XOF)                         | pay monthly in XOF via the Upgrade button   | checkout shows CFA 4000, card + Mobile Money tabs; webhook `amount` 4000 XOF matches the row; Pro granted |
| EUR charged in XOF                          | pay monthly in EUR via the Upgrade button   | site shows €7; checkout opens (with `payment_category=card` appended) on the card tab only and shows CFA 4592; webhook `amount` 4592 XOF; SUCCEEDED, not NEEDS_REVIEW |
| USD charged in XOF                          | pay monthly in USD via the Upgrade button   | the only real test of the Frankfurter rate: checkout shows CFA ≈ 7 × USD→EUR × 655.957, card tab only; webhook amount equals the stored XOF amount; SUCCEEDED |
| Declined then good card, same page          | `…0291`, then `…0275` on the same checkout  | `failed` webhook → FAILED, then `succeeded` → SUCCEEDED and Pro granted (FAILED → SUCCEEDED path) |
| Same link paid twice                        | pay one checkout link twice                 | Pro extended once; `[billing] second payment on a settled checkout` logged with the new transaction id |
| EUR/USD card-only                           | start checkout in EUR                       | no Mobile Money tab |
| Yearly card success with 3DS challenge      | `2303 7799 9900 0408`, OTP `1234`           | Pro until + 365 d |
| Card failure                                | `2303 7799 9900 0291`                       | error page, payment FAILED, still Free |
| Early renewal stacks                        | pay monthly twice                           | + 60 d total |
| Webhook retry / duplicate                   | replay the same webhook (curl with the secret) | Pro extended once |
| Forged webhook                              | curl without / with a wrong `X-Secret-Key`  | 401, nothing changes |
| Late webhook                                | disable webhook URL, pay                    | return page polls and shows the Bictorys status; Pro granted when the webhook arrives (or by the fallback, if §7.5 allows it) |
| Amount/currency mismatch                    | replay a captured webhook with a lower amount | payment `NEEDS_REVIEW`, no Pro, error logged |
| Mobile Money (Wave/Orange)                  | scan QR with the sandbox simulator          | webhook grants Pro; **no redirect in sandbox [doc]** |
| Gating                                      | Free user creates item 51 / collection 4 / upload | refused with upgrade message |
| Expiry                                      | set `proUntil` to the past on the develop DB | gates apply again, data intact |

Also: `npm run build`, `npm run lint`. Use the Neon **develop** branch only.

---

## 10. Open questions (ask Bictorys support or confirm in sandbox)

1. Exact webhook headers in sandbox: is `X-Webhook-Signature` sent? (handled either way)
2. `errorRedirectUrl` vs `ErrorRedirectUrl` casing.
3. Do redirect URLs have to be `https://`?
4. Response shape of `GET /pay/v1/transactions/{id}/status`.
5. Hosted checkout returns only `chargeId` (202, sandbox-verified): does the status endpoint
   accept it, and does the webhook `id` equal it?
6. Does the webhook `amount` include customer fees for our fee setting? For EUR/USD, does the
   webhook report the charged currency or the converted XOF? (the handler expects the charged
   currency — check the first sandbox webhook)
7. Webhook for refunds (`reversed`): if it arrives, should Pro time be removed? Proposed: log and
   handle manually for now.
8. Does a pending checkout expire after 2 h (status page says so)? Pending rows older than that
   can be treated as abandoned (display only, no cleanup job needed).
9. Foreign cards in live mode, EUR/USD → XOF conversion rate and fees, and payout options
   (Mobile Money documented; bank/IBAN seen in the dashboard). Not blocking for development —
   payouts are done from the dashboard, not the code.

10. **[new]** EUR card payment fails in sandbox: `3DS PSP error [422] … For the scheme MASTERCARD
    and channel Ecom, the payment channel is not configured` (test card `2303 7799 9900 0275`,
    which works in XOF). All documented test cards are Mastercard. Ask support whether EUR/USD card
    payments can be enabled (sandbox and live) and for a Visa test card. Deferred by the author.

11. **[new]** Iframe mode (`/docs/elements`): is it available (sandbox and live)? What is the real
    `bictorys.js` URL (the docs show a placeholder)? Which methods does it offer? Does it need a
    server-created charge, or does `Bictorys.Charges.init` create one? (The Checkout page calls it
    "pas encore disponible"; its only documented styling is the iframe container's CSS.)
12. **[new]** Can foreign Visa/Mastercard cards pay on the **XOF** card channel in live? Needed
    before deciding to charge EUR/USD customers in XOF. Note for that decision: €7 ≈ 4 592 XOF
    while `BILLING_PLANS` charges 4 000 XOF, so converting would make EUR customers pay ~15 % more
    than XOF customers; the consistent model would be XOF-only charges with EUR/USD shown as "≈".

Send q10–q12 to support@bictorys.com in one message.
Author's working assumption (2026-11-23): EUR/USD card payments are only enabled in **live**
(Bictorys advertises EUR/USD collection — LinkedIn post, ~July 2026 — but the sandbox refuses it).
Until proven, EUR/USD stay charged in XOF. Go-live check: one real small EUR charge with a real
foreign card; if it succeeds, add `"EUR", "USD"` to `CHARGED_DIRECTLY` in `billing-plans.ts`.

**Answered in sandbox, 2026-11-23** (fixtures in `src/lib/__fixtures__/bictorys/`):

- **q1** — Headers sent: `X-Secret-Key` (matches the dashboard secret) and `X-Webhook-Version: 1`.
  **No `X-Webhook-Signature` / `X-Webhook-Timestamp`.** User agent `ReactorNetty/1.1.5`,
  `Content-Type: application/json`.
- **q3** — `https://` tunnel URLs were accepted for both redirects; the success redirect is
  followed after a card payment. Plain `http://` on a public host is accepted too, but **any
  `localhost` redirect URL is refused by the Bictorys WAF (HTML 403)**, so local checkout needs
  the tunnel URL in `APP_URL`; with `APP_URL=http://localhost:3000`, `startCheckout` returns
  its generic error.
- **q4** — `GET /pay/v1/transactions/{id}/status` returns `{ id, status }` only: **no amount, no
  currency**. So the fallback cannot verify a payment and stays display-only (§7.5).
- **q5** — **The webhook `id` is not the `chargeId`.** The hosted checkout's `chargeId` is a
  separate id; the status endpoint answers `{ "id": null, "status": "pending" }` for it (HTTP
  200, misleading). With the webhook `id` (the transaction id) it returns the real status. The
  stored `transactionId` must therefore be replaced by the webhook `id` when the webhook arrives.
- **q6** — With the default setting (merchant pays; no fee option found in the sandbox
  dashboard), `amount` is the charged amount exactly (`4000`), with `merchantFees: 121.9` and
  `customerFees: 0` reported separately. `currency` is the charged currency. The payload also
  carries `settledAmount` / `settledCurrency` (`4000` / `XOF` here; the docs' example shows
  `10 EUR` settled as `6500 XOF`), so for EUR/USD the check uses `amount` + `currency`, never the
  settled pair. Not yet confirmed with a real EUR webhook (see q10).
- **A hosted-checkout link can be paid more than once.** The charge `capture-XOF2-…` shows **three**
  succeeded transactions in the dashboard, each with its own transaction id. So a webhook for a
  payment that is no longer PENDING is either a retry (same `id` as the stored `transactionId`:
  ignore) or a second real payment (different `id`: log an error with that id for a manual
  refund, grant no Pro).
- Payload also has `eventType: null`, `type: "payment"`, `pspName`, `orderDetails`, and a
  `timestamp` without a time zone (`2026-11-23 00:49:07.334538`).

Decisions for the author:

- Prices per currency (§2.2 — accepted as a starting point, editable in `BILLING_PLANS`) and the
  default currency (USD proposed).
Decided 2026-11-22:

- `isPro` is **kept**, as a mirror of `proUntil` (§7.1).
- `Payment` rows are **kept** when an account is deleted (`SetNull`), for now.
- File and image uploads are **Pro-only**.

---

## 11. Implementation order

1. Feature doc in `context/current-feature.md`, branch `feature/bictorys-billing`.
2. Schema + migration (`proUntil`, `Payment`, enums, drop Stripe fields), seed fix, generate,
   restart dev server.
3. `src/lib/billing-plans.ts` + tests (pure, client-safe) and `src/lib/bictorys.ts` + tests.
4. **Capture real webhooks before writing the confirm logic**: tunnel + sandbox webhook (§8),
   fee setting chosen, then a temporary logging-only webhook route that verifies `X-Secret-Key`
   and logs the raw headers and payload. Make one card payment in **XOF** and one in **EUR**.
   This answers §10 questions 1, 4, 5 and 6 (headers, status response, `chargeId` vs `id`,
   fees in `amount`, currency reported). Save the payloads (secrets removed) as test fixtures.
5. `src/lib/db/billing.ts` + tests.
6. `src/lib/billing-webhook.ts` (`verifyWebhook`, `applyPaymentStatus`, handler) + tests using
   the captured fixtures; replace the logging route with the real one.
7. `src/actions/billing.ts` + rate limit entry + tests.
8. Settings "Plan" section, upgrade buttons, `/settings/billing` return page.
9. `src/auth.ts` session `isPro` (UI convenience).
10. Gating in items, collections, upload route (+ test updates), New Item dialog.
11. Env files, `vitest.config.mts`, pricing page currency switch + CTA, `project-overview.md`.
12. Run the full manual sandbox checklist (§9).
13. `npm test`, `npm run build`, `npm run lint` → ask before committing.

Steps 2–7 can ship as one PR (payments work, nothing gated) and step 10 as a second one, if the
author prefers smaller changes.

# Bictorys Integration Research

> Replaces the earlier Stripe research. Stripe is not available in the author's country, so
> payments go through **Bictorys** (West African payment aggregator: Wave, Orange Money, MTN,
> cards…). The sandbox account exists and the keys are configured.

## Output

`docs/bictorys-integration-plan.md`

## Research

Analyze the codebase and the Bictorys documentation to create a comprehensive Pro subscription
integration plan for Cortex Pro (currently **$7/month or $63/year** — see
`src/components/home/PricingPlans.tsx` and `context/project-overview.md`).

Bictorys only charges in **XOF** (integer amounts, no decimals, minimum 100). The plan must
propose XOF amounts for monthly and yearly, explain how they relate to the USD prices shown on the
site, and flag this as a decision for the author to confirm (do not change the displayed prices).

### Bictorys documentation to read

- Integration guide: https://docs.bictorys.com/docs/integration
- Doc index: https://docs.bictorys.com/llms.txt
- Webhook validation: https://docs.bictorys.com/docs/how-to-validate-webhooks
- Payment statuses: https://docs.bictorys.com/docs/status-responses-and-their-meanings
- Hosted checkout: https://docs.bictorys.com/docs/how-checkout-works
- Charges: https://docs.bictorys.com/reference/createcharge
- Subscriptions (Billing API): https://docs.bictorys.com/reference/createsubscription,
  `/reference/cancelsubscription`, and the Subscription Plan endpoints
  (`/reference/createsubscriptionplan`, etc.)
- Test cards page ("Cartes bancaires de Test") for sandbox testing

Known facts (verify against the docs, they may have changed):

- Sandbox base URL `https://api.test.bictorys.com`, live `https://api.bictorys.com`.
- Auth header `X-Api-Key`. Public key (`test_public-…`) for charges and status checks; private key
  (`test_secret-…`) for payouts and payment-method listing.
- Hosted checkout: `POST {BICTORYS_API_URL}/pay/v1/charges` with `amount`, `currency: "XOF"`,
  `paymentReference` (unique per order), `successRedirectUrl`, `ErrorRedirectUrl` (note the
  capital E), optional `customerObject`. Response `201` contains `transactionId` and `redirectUrl`.
- Status check: `GET {BICTORYS_API_URL}/pay/v1/transactions/{transactionId}/status`.
- Statuses: `succeeded`, `authorized`, `pending`, `processing`, `failed`, `cancelled`, `reversed`.
  Pending transactions expire after ~2 hours.
- Webhooks: JSON `POST` with an `X-Secret-Key` header to compare with the webhook secret. The guide
  also mentions an optional HMAC-SHA256 `X-Webhook-Signature` + `X-Webhook-Timestamp`, but the
  official validation page does not — treat HMAC as unconfirmed. Bictorys retries 3 times when the
  response is not 200.
- Native subscriptions exist under `{base}/billing/v1` (Subscription Plan + Subscription,
  status `opened` / `started` / `cancelled` / `completed`). Installments are described as monthly
  and a payment request is sent to the customer on each due date. It is **not** documented whether
  a saved card is debited automatically or whether yearly plans are supported.

## Include

### Current State Analysis

- User model schema (`isPro`, `stripeCustomerId`, `stripeSubscriptionId`) and what should replace
  or be added for Bictorys (e.g. provider-neutral customer / subscription ids, a Pro expiry date,
  a payments table for `paymentReference` idempotency). Schema changes go through
  `prisma migrate dev`.
- NextAuth configuration and session handling
- How user data is accessed in server actions and components
- Any existing subscription or payment-related code, and the Stripe leftovers to remove
  (`STRIPE_*` variables in `.env`, `.env.example`, `.env.production`; mentions in
  `context/project-overview.md`)

### Billing Model Decision

Compare and recommend one of:

1. **Native Bictorys subscriptions** (Billing API): what is automatic, what the customer must do
   each cycle, how monthly vs yearly would work, how cancellation and failed installments are
   reported (webhooks?).
2. **One-off charges with a Pro expiry date**: each payment (monthly or yearly) extends
   `proUntil`; Pro is active while `proUntil > now`; renewal is a new checkout (with reminder
   e-mail via Resend). No recurring debit.

State clearly which facts come from the docs and which are assumptions or open questions to ask
Bictorys support.

### Feature Gating Analysis

- Free tier limits from project spec (50 items, 3 collections)
- Where item/collection counts are checked or could be checked
- Pro-only features (file uploads, AI, custom types, export)
- Settings page structure (where "Upgrade" / "Manage subscription" goes)
- How Pro status is computed if an expiry date is used (single helper, not scattered checks)

### API & Webhook Patterns

- How API routes are structured (webhook route at `src/app/api/webhooks/bictorys/route.ts` or
  similar — read the route handler docs in `node_modules/next/dist/docs/`)
- Webhook security: constant-time comparison of `X-Secret-Key`, HMAC if present, then re-check
  amount, currency, status and `paymentReference` against our own pending payment record;
  idempotency on repeated deliveries; always return 200 once handled
- Never trust `successRedirectUrl` alone: the success page only shows a status, the webhook
  (or a server-side status check) is the source of truth
- Server action error handling patterns
- Rate limiting (Upstash is already in the project) for the checkout action
- Environment variable patterns

## Environment

Already configured in `.env` and `.env.production` (sandbox values):

```
BICTORYS_API_URL=          # sandbox URL
BICTORYS_API_KEY=          # test public key
BICTORYS_PRIVATE_KEY=      # test secret key
BICTORYS_WEBHOOK_SECRET=
BICTORYS_MERCHANT_SECRET_CODE=   # empty, only needed for payouts
```

The plan must add them (empty) to `.env.example` and blank them in `vitest.config.mts` like the
other service variables.

## Deliverable

A complete implementation plan with:

1. Files to create (with code examples)
2. Files to modify (with specific changes)
3. Bictorys Dashboard setup steps (sandbox webhook URL, plans if native subscriptions are used,
   switching to live keys later)
4. Local webhook testing (Bictorys needs a public HTTPS URL — e.g. a tunnel to `localhost:3000`)
5. Testing checklist (unit tests for the server actions and the webhook handler logic with
   mocked `fetch`, plus manual sandbox payments with test cards / Wave / Orange Money)
6. Implementation order
7. Open questions to confirm with the author or with Bictorys support

## Notes

The NextAuth v5 documentation suggests using `trigger === "update"` in the JWT callback to refresh
session data when calling `update()` from `useSession()`. However, this approach doesn't reliably
work for our use case where a Bictorys webhook updates `isPro` in the database and we want the
client session to pick up the change.

**The workaround:** Instead of relying on `trigger === "update"`, modify the JWT callback to always
sync `isPro` from the database on every session validation:

```typescript
async jwt({ token, user }) {
  if (user) {
    token.sub = user.id;
  }

  // Always sync isPro from database to catch webhook updates
  if (token.sub) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { isPro: true },
    });
    token.isPro = dbUser?.isPro ?? false;
  }

  return token;
},
```

This adds one small DB query per session validation but guarantees the session stays in sync after
webhook updates. A simple page reload after checkout is then sufficient to pick up the new Pro
status. If an expiry date is used, select it here too and derive `isPro` from it.

# Bictorys Billing — Phase 2: Integration & UI

## Overview

Connect the Phase 1 infrastructure to Bictorys and to the app. This phase covers:

- the webhook that grants Pro;
- the checkout action and the payment return page;
- the Plan section in Settings and the currency switch on the pricing page;
- gating Free accounts (50 items, 3 collections, and no file or image uploads).

Reference: `docs/bictorys-integration-plan.md` (§ numbers below point there). Requires
`bictorys-phase-1-spec.md` to be merged.

**Testing needs a public tunnel and the Bictorys sandbox (§8).** Bictorys has no CLI that
forwards webhooks to localhost. The setup is:

1. A tunnel to the dev server: `cloudflared tunnel --url http://localhost:3000` or
   `ngrok http 3000`. Its URL goes in `APP_URL`, then the dev server restarts.
2. In the Bictorys dashboard, under Developers → Webhooks (test environment), the webhook points
   to `https://<tunnel>/api/webhooks/bictorys`. Its secret goes in `BICTORYS_WEBHOOK_SECRET`.
3. The fee setting (merchant or customer pays) is chosen in the dashboard **before** capturing
   webhooks, because it changes the webhook `amount`.
4. `curl` replays a captured webhook to test duplicates, forgeries and amount mismatches.

## Requirements

### 1. Capture real webhooks first (§11 step 4)

The confirm logic depends on payloads that the docs describe inconsistently, so record real ones
before writing it.

- Add a temporary **logging-only** `POST /api/webhooks/bictorys`. It checks `X-Secret-Key` and
  logs the raw headers and body. It changes nothing in the DB. It always answers 200, or
  Bictorys retries each event 3 times.
- Create the charges with `curl` straight to `POST {BICTORYS_API_URL}/pay/v1/charges`, using the
  public key. No UI or action exists yet. Build `successRedirectUrl` and `errorRedirectUrl`
  from the tunnel's `https://` URL (§10 q3). Make one card payment in **XOF** and one in **EUR**,
  with test card `2303 7799 9900 0275`.
- Call `GET /pay/v1/transactions/{chargeId}/status` once and log the response.
- These payloads answer §10 questions 1, 4, 5 and 6:
  - whether `X-Webhook-Signature` is sent;
  - the shape of the status response;
  - whether the webhook `id` equals `chargeId`;
  - whether `amount` includes fees, and whether EUR is reported as EUR or converted to XOF.
- Save the payloads, with secrets removed, as fixtures next to `billing-webhook.test.ts`. Write
  the answers into `docs/bictorys-integration-plan.md` §10.

### 2. `src/lib/billing-webhook.ts` — server-only (§7.2b, §7.5)

- `verifyWebhook(headers, rawBody, secret, now)`:
  - `X-Secret-Key` is required and compared in constant time.
  - The HMAC (`X-Webhook-Signature` and `X-Webhook-Timestamp`) is checked **only when both
    headers are present**, with a skew of at most 5 minutes.
  - An empty secret returns false.
- A Zod payload schema (`paymentReference`, `status`, `amount`, `currency`, and optional `id`)
  with `.passthrough()`.
- `applyPaymentStatus(reference, reported)` is the **single confirm path**, used by both the
  webhook and the fallback:
  - `succeeded` or `authorized`: a currency or amount mismatch marks the payment `NEEDS_REVIEW`,
    logs an error and grants no Pro. Otherwise it calls `markPaymentSucceeded`.
  - `failed` or `cancelled`: `markPaymentFailed`.
  - `pending`, `processing` or `reversed`: no change. `reversed` is logged for manual handling.
  - It does nothing for an unknown reference or a payment that is no longer PENDING.
- Decide `amountMatches` from the captured fixtures, not from the docs. Compare with what was
  charged, never with a converted amount.
- `handleBictorysWebhook(headers, rawBody)` returns:
  - 401 when verification fails;
  - 400 for invalid JSON;
  - 200 for a payload it does not recognise (acknowledged and ignored);
  - 200 once the payment is handled.
- A thrown DB error propagates, so the route returns 500 and Bictorys retries.
- Never imported by a client component, because it uses `node:crypto`.

### 3. `src/app/api/webhooks/bictorys/route.ts` (§7.6)

- Replaces the logging route. It is a thin wrapper: read `request.text()`, call
  `handleBictorysWebhook`, and turn a thrown error into a 500.
- `/api/*` is outside the proxy matcher, so the route is public and authenticated by the
  secret.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` first.

### 4. `src/actions/billing.ts` (§7.7)

- `startCheckout({ plan, currency })` follows the usual action pattern:
  1. Zod validation, auth, and the `checkout` rate limit.
  2. `APP_URL` must be set.
  3. Load the profile, then `createPendingPayment`, then `createCharge`.
  4. Store `transactionId`, then return `{ success, redirectUrl, error }`.
- The client redirects with `window.location.assign(redirectUrl)`.
- `refreshPaymentStatus(reference)`:
  - Checks that the payment belongs to the signed-in user.
  - Calls `getTransactionStatus` and returns the row's status.
  - **Display only by default.** Granting stays with the webhook unless the captured status
    response carries amount and currency (§7.5). Record the decision in the spec when made.
  - **Decided (2026-11-23):** display only, read from the DB alone. The status response is
    `{ id, status }` with no amount or currency, and it only knows the webhook's transaction id,
    not the hosted checkout's `chargeId` (plan §10 q4, q5).
- Optional guard, for the author to decide: refuse checkout for a Pro user with more than a year
  left.

### 5. Session — `src/auth.ts` and `src/types/next-auth.d.ts` (§7.9)

- Add `proUntil` and `isPro` to the select the `jwt` callback already makes, so there is no
  extra query. Set `token.isPro = isProActive(proUntil)`.
- When Pro expires, reset the stored flag lazily with a single
  `updateMany({ where: { id, isPro: true }, data: { isPro: false } })`.
- `session.user.isPro` exists for the UI only. Server-side gates read `getPlanStatus` at the
  moment of the check.

### 6. UI

- **Settings** (`src/app/(app)/settings/page.tsx`): add a **Plan** section (`id="plan"`) above
  Editor. It shows:
  - `Pro until <date>`, or `Free — X/50 items, Y/3 collections`, using `getPlanStatus`;
  - upgrade buttons, or extend buttons for Pro.
  - Update the page description.
- **`src/components/settings/UpgradeButtons.tsx`** (client leaf):
  - A USD / EUR / XOF switch. Its initial value comes from `?currency=`, otherwise
    `DEFAULT_CURRENCY`.
  - Prices from `BILLING_PLANS` through `formatPrice`.
  - "Card only" for USD and EUR; "Card or Mobile Money" for XOF.
  - Monthly and yearly buttons that call `startCheckout`, with a pending state and the action's
    error message.
- **Return page** `src/app/(app)/settings/billing/page.tsx`:
  - Async server page with `await connection()`. `searchParams` is async, so check the Next 16
    docs.
  - It loads the payment for `ref` that belongs to **the current user only**.
  - SUCCEEDED: "You're Pro until <date>".
  - PENDING: "Confirming your payment…", with a client leaf that calls `refreshPaymentStatus`
    every 3 s, at most about 10 times, then calls `router.refresh()`.
  - NEEDS_REVIEW: "We received your payment and are checking it — contact support if this takes
    long."
  - FAILED or `error=1`: "The payment did not go through", with a retry link to `/settings#plan`.
  - The page never grants Pro itself.
- **Pricing** (`src/components/home/PricingPlans.tsx`):
  - Add a USD / EUR / XOF switch next to the monthly / yearly switch.
  - Read the prices from `BILLING_PLANS` instead of the hard-coded `$7` / `$63` / `$5.25`.
  - "Get Pro" links to `/settings?currency=<chosen>#plan`.
  - The switch is display only and nothing is stored.

### 7. Gating (§7.10)

Every check runs on the server and uses `getPlanStatus` with the `usage-limits` predicates and
`LIMIT_MESSAGES`.

- `createItem` (`src/actions/items.ts`):
  - It refuses a new item when `!canCreateItem(plan)`.
  - It refuses the `file` and `image` types when `!canUploadFiles(plan)`, and deletes the
    uploaded object through the existing cleanup path.
- `createCollection` (`src/actions/collections.ts`): refused when `!canCreateCollection(plan)`.
- `POST /api/upload`: after the session check and before reading the body, answer `403` with the
  upload message to non-Pro users.
- New Item dialog: hide or disable File and Image for Free users. The flag is passed as a prop
  from the server, not through `useSession`.
- Existing data is never removed. Free accounts over a limit keep their data, and so do lapsed
  Pro accounts.

### 8. Docs

`context/project-overview.md`:
- Replace the Stripe line with Bictorys: one-off payments in USD, EUR or XOF that extend
  `proUntil`.
- Update the User schema listing and add `Payment`.

## Files

| Action | File |
| ------ | ---- |
| create | `src/lib/billing-webhook.ts` + `billing-webhook.test.ts` + captured fixtures |
| create | `src/app/api/webhooks/bictorys/route.ts` |
| create | `src/actions/billing.ts` + `billing.test.ts` |
| create | `src/app/(app)/settings/billing/page.tsx` + polling client leaf |
| create | `src/components/settings/UpgradeButtons.tsx` |
| modify | `src/auth.ts`, `src/types/next-auth.d.ts` |
| modify | `src/actions/items.ts`, `src/actions/collections.ts`, `src/app/api/upload/route.ts` (+ tests) |
| modify | `src/app/(app)/settings/page.tsx`, `src/components/home/PricingPlans.tsx`, New Item dialog |
| modify | `context/project-overview.md`, `docs/bictorys-integration-plan.md` §10 |

## Testing

### Unit tests (mocks only; run with `npm test` through Windows npm)

- **`billing-webhook.test.ts`**:
  - `verifyWebhook`: missing key, wrong key, wrong length, good key, good and bad HMAC, stale
    timestamp, key alone accepted when the HMAC is absent, and an empty secret returns false.
  - `applyPaymentStatus`: `succeeded` and `authorized` grant Pro. A wrong currency or amount
    gives `NEEDS_REVIEW` and no Pro. `failed` marks the payment failed, `pending` changes
    nothing, and a row that is not PENDING is left alone.
  - Handler: 401, 400, 200 for an unknown reference, and a DB error throws.
  - Use the **captured fixtures**.
- **`actions/billing.test.ts`**:
  - `startCheckout`: invalid plan, invalid currency, signed out, rate limited, missing
    `APP_URL`.
  - The amount comes from the table for each currency, and an amount sent by the client is
    ignored.
  - The charge is called with the right URLs, and `transactionId` is stored.
  - A Bictorys error returns a friendly message.
  - `refreshPaymentStatus`: another user's reference is refused.
- **`items.test.ts` / `collections.test.ts`**: mock `getPlanStatus`.
  - Free at 49 items succeeds, Free at 50 is refused, and Pro at 50 succeeds.
  - The same rule for collections at 2 and 3.
  - File and image items are refused for Free accounts.

### Manual sandbox tests through the tunnel (§9)

| Scenario | How | Expected |
| -------- | --- | -------- |
| Monthly card, frictionless | `2303 7799 9900 0275`, `12/30` | Return page shows Pro until now + 30 d |
| Each currency | Monthly in USD, EUR and XOF | Checkout shows $7, €7 and CFA 4000; Pro granted |
| EUR/USD card only | Checkout in EUR | No Mobile Money tab |
| Yearly with 3DS | `2303 7799 9900 0408`, OTP `1234` | Pro until + 365 d |
| Card failure | `2303 7799 9900 0291` | Error page, payment FAILED, still Free |
| Early renewal | Pay monthly twice | + 60 d in total |
| Duplicate webhook | `curl` replay with the secret | Pro extended once |
| Forged webhook | `curl` without the secret or with a wrong one | 401, nothing changes |
| Late webhook | Webhook URL disabled, then pay | Return page polls and shows the status; Pro arrives with the webhook |
| Amount mismatch | Replay with a lower amount | `NEEDS_REVIEW`, no Pro, error logged |
| Mobile Money | Sandbox QR simulator (XOF) | Webhook grants Pro. There is no redirect in the sandbox |
| Gating | Free account: item 51, collection 4, an upload | Refused with the upgrade message |
| Expiry | Set `proUntil` in the past on the **develop** DB | Gates apply again, data intact, `isPro` reset |

Then run `npm test`, `npm run build` and `npm run lint`. Check the UI in the browser with the
Playwright script.

## Notes

- Use the Neon **develop** branch only. Production setup (live keys, the live webhook and the
  production migration) is the author's job (§8 step 6).
- If the author prefers smaller PRs, ship sections 1–6 first, with payments working and nothing
  gated, and section 7 after.
- Branch: `feature/bictorys-billing-phase-2`.

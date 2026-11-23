# Bictorys Billing — Phase 1: Core Infrastructure

## Overview

Lay the groundwork for Cortex Pro payments through Bictorys: the schema, the price table, the
usage limits, the Bictorys HTTP client and the payment queries. Nothing users can see changes and
nothing is gated yet. Everything in this phase is checked by unit tests and the build alone. It
needs no tunnel and no sandbox payment.

Reference: `docs/bictorys-integration-plan.md` (§ numbers below point there). Billing model:
one-off charges that extend `proUntil` (§3, option 2). Phase 2
(`bictorys-phase-2-spec.md`) adds the webhook, checkout, UI and gating.

## Requirements

### Schema (§7.1)

- `User`: add `proUntil DateTime?` and `payments Payment[]`. Remove `stripeCustomerId` and
  `stripeSubscriptionId`.
- **Keep `isPro`** as a mirror of `proUntil`. It is a readable flag only. Every gate reads
  `isProActive(proUntil)`.
- New enums `BillingPlan` (MONTHLY, YEARLY), `Currency` (USD, EUR, XOF) and `PaymentStatus`
  (PENDING, SUCCEEDED, FAILED, NEEDS_REVIEW).
- New `Payment` model:
  - `reference` is unique, and `transactionId` is unique and optional.
  - `userId` is optional with `onDelete: SetNull`, so payments are kept when an account is
    deleted.
  - Index on `[userId, createdAt]`.
- Migration: `npx prisma migrate dev --name bictorys_billing`, never `db push`. Apply it to the
  Neon **develop** branch only. Then run `prisma generate` and **ask before restarting the dev
  server**, because a running server keeps the old client.
- `prisma/seed.ts`: confirm it does not reference the dropped `stripe*` fields.

### `src/lib/billing-plans.ts` — pure, client-safe (§7.2)

- `CURRENCIES` and `BILLING_PLANS`, with the prices per currency from §2.2:

  | Plan    | Days | USD | EUR | XOF    |
  | ------- | ---- | --- | --- | ------ |
  | Monthly | 30   | 7   | 7   | 4 000  |
  | Yearly  | 365  | 63  | 63  | 36 000 |

- `DEFAULT_CURRENCY = "USD"`.
- `formatPrice` returns "$7", "€7" and "4 000 FCFA".
- `isProActive(proUntil, now)` is the **only** place that compares dates to decide Pro.
- `extendProUntil(current, days, now)`: paying early adds the days to the remaining time, and
  paying after expiry counts from now.
- No Node-only imports (`node:crypto`, Prisma), because client components import this file in
  Phase 2.

### `src/lib/usage-limits.ts` — pure, client-safe (new; differs from §7.2)

The plan puts `FREE_LIMITS` in `billing-plans.ts`. This phase moves the Free plan rules into
their own module instead, so the Phase 2 gates and UI share a single source for them.

- `FREE_LIMITS = { items: 50, collections: 3 }`.
- Predicates that take the `getPlanStatus` shape `{ isPro, items, collections }`:
  - `canCreateItem(plan)`: true for Pro, or for Free while `items < FREE_LIMITS.items`.
  - `canCreateCollection(plan)`: the same rule with `FREE_LIMITS.collections`.
  - `canUploadFiles(plan)`: true for Pro only, because file and image uploads are Pro-only.
- `LIMIT_MESSAGES` holds the user-facing errors, so the actions and the upload route word them
  the same way:
  - "Free accounts can have 50 items. Upgrade to Pro in Settings."
  - "Free accounts can have 3 collections. Upgrade to Pro in Settings."
  - "File and image uploads are a Pro feature."
- Keep it separate from `src/lib/db/limits.ts`. That file holds list ceilings, not plan limits.

### `src/lib/bictorys.ts` — thin HTTP client (§7.3)

- `createCharge(input)` sends `POST {BICTORYS_API_URL}/pay/v1/charges` with the `X-Api-Key`
  header and a 15 s timeout.
- The hosted checkout answers `202 { link, chargeId }`, and the documented shape is
  `201 { redirectUrl, transactionId }`. Handle both: `redirectUrl ?? link` and
  `transactionId ?? chargeId`.
- A non-2xx response throws with the status and at most 300 characters of the body. A missing
  environment variable also throws.
- `getTransactionStatus(transactionId)` returns `status`, or `null` on an error. The response
  shape is an **[assumption]** that Phase 2 confirms.

### `src/lib/db/billing.ts` — queries (§7.4)

- `getPlanStatus(userId)` returns `{ proUntil, isPro, items, collections }`.
- `createPendingPayment(userId, plan, currency)` takes the amount from `BILLING_PLANS`, never
  from the client, and builds the reference as `cortex_<cuid>`.
- `setPaymentTransactionId`, `findPaymentByReference`, `markPaymentFailed` (touches PENDING rows
  only) and `markPaymentNeedsReview`.
- `markPaymentSucceeded(reference, now)` is **idempotent**:
  - It claims the row with `updateMany` where the status is PENDING, so a second call changes
    nothing.
  - It extends `proUntil` and sets `isPro: true` in the same transaction.
  - If the user was deleted, it records the payment and skips the user update.
- `$transaction` has not been used in `src/` before. `PrismaNeon` (WebSocket) should support
  interactive transactions. Verify that once on the develop DB.

### Other changes

- `src/lib/rate-limit.ts`: add `checkout: { attempts: 5, window: "15 m" }` to `LIMITS`.
- `vitest.config.mts`: blank `BICTORYS_API_URL`, `BICTORYS_API_KEY`, `BICTORYS_PRIVATE_KEY` and
  `BICTORYS_WEBHOOK_SECRET` in `test.env`.
- `.env.example`: remove `STRIPE_*`, and add `BICTORYS_API_URL=`, `BICTORYS_API_KEY=` and
  `BICTORYS_WEBHOOK_SECRET=`. Tell the author to remove `STRIPE_*` from `.env` and
  `.env.production`, which are their files.

## Files

| Action | File |
| ------ | ---- |
| create | `src/lib/billing-plans.ts` + `billing-plans.test.ts` |
| create | `src/lib/usage-limits.ts` + `usage-limits.test.ts` |
| create | `src/lib/bictorys.ts` + `bictorys.test.ts` |
| create | `src/lib/db/billing.ts` + `billing.test.ts` |
| create | `prisma/migrations/<ts>_bictorys_billing/` |
| modify | `prisma/schema.prisma`, `prisma/seed.ts` (if needed) |
| modify | `src/lib/rate-limit.ts`, `vitest.config.mts`, `.env.example` |

## Testing

All tests use mocks only, with no real Bictorys and no real DB. `mockReset` is on, so set return
values in the test or in `beforeEach`. Run the tests through Windows npm:
`cmd.exe /c "E: && cd \PROGRAMMING\CODE\codstash && npm test"`.

- **`usage-limits.test.ts`**:
  - Free with 49 items can create an item, and with 50 it cannot.
  - Pro with 50 or more items can create an item.
  - Free with 2 collections can create a collection, and with 3 it cannot. Pro with 3 can.
  - `canUploadFiles` is false for Free and true for Pro.
  - The messages name the limits from `FREE_LIMITS`.
- **`billing-plans.test.ts`**:
  - Every plan has a whole, positive price in every currency, and XOF prices are at least 100.
  - `formatPrice` returns "$7", "€7" and "4 000 FCFA".
  - `isProActive` for null, the past, the future and exactly now.
  - `extendProUntil` for null, expired (counts from now) and active (adds to the remaining time).
- **`bictorys.test.ts`** stubs `fetch` with `vi.stubGlobal` and checks:
  - the URL, the `X-Api-Key` header and the body fields;
  - the `redirectUrl`/`link` and `transactionId`/`chargeId` fallbacks;
  - that a non-2xx response throws with the status, and a missing env throws;
  - that `getTransactionStatus` returns `null` on an error.
- **`db/billing.test.ts`**:
  - `createPendingPayment` takes the amount from the table for each currency.
  - `markPaymentSucceeded` applies once: PENDING becomes SUCCEEDED, `proUntil` is extended and
    `isPro` set. A second call does nothing, and so does an unknown reference.
  - A deleted user records the payment without a user update.
  - `markPaymentFailed` only touches PENDING rows.
  - `prisma.$transaction` is new to this repo. Because `mockReset` is on, mock it in
    `beforeEach` so that it calls its callback with the mocked client.
- `npm test`, `npm run build` and `npm run lint` pass.

## Notes

- No UI, no webhook and no gating in this phase. The app behaves exactly as before. The only
  difference is the new columns and table on the develop DB.
- The production DB is off-limits. The author applies the production migration.
- Branch: `feature/bictorys-billing-phase-1`.

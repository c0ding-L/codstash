# Production checklist

What is left to do before Cortex is open to the public, collected from the feature history
(`context/current-feature.md`) and the local `.env` files on 2026-11-27. Production runs on
`https://codstash.vercel.app` with the Neon `production` branch.

The real values live in Vercel's environment variables, which this list could not read.
`.env.production` is a local copy and may be out of date, so every "set" below means "check on
Vercel". Start with the database and the environment variables: without them, code already on
`main` breaks in production.

## 1. Database

`next build` does not run migrations, and production has been kept off limits during development.
Several features are flagged in the history as needing `prisma migrate deploy` before their code
runs there.

- [ ] Run `prisma migrate status` against production to see which of the 11 migrations are missing:
  - `20260801221937_init`
  - `20260920003036_add_query_indexes`
  - `20261005012806_add_password_changed_at`
  - `20261107000000_link_color_lime` (rows still on `yellow` lose their accent until it runs)
  - `20261120120000_item_collections`
  - `20261122010400_user_editor_preferences`
  - `20261122234851_bictorys_billing` (check the Stripe columns and the `isPro` users first)
  - `20261125151659_user_locale`
  - `20261126210956_custom_item_types`
  - `20261127021635_item_last_used`
  - `20261127145330_api_tokens`
- [ ] Take a Neon snapshot of `production`, then run `prisma migrate deploy` against it.
- [ ] Decide whether the deploy runs migrations automatically (a build step on Vercel) or stays a
  manual step.
- [ ] Delete the test accounts left in production: `phase2@test.dev`, `uitest@test.dev`,
  `numtest@test.dev`.
- [ ] Remove the `STRIPE_*` variables from `.env.production` and from Vercel (replaced by Bictorys).

## 2. Environment variables (Vercel, Production)

| Variable | State in `.env.production` | What breaks without it |
| --- | --- | --- |
| `APP_URL` | empty | Verification and reset email links, the payment return URL |
| `AUTH_URL` | absent | Auth callbacks and the MCP setup card's address (falls back to the request host) |
| `EMAIL_FROM` | empty | Every email; must be `Cortex <…@your-domain>` on a domain verified in Resend |
| `EMAIL_VERIFICATION_ENABLED` | empty (= on) | Leave unset or `true` in production; `false` only for local testing |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | set | Rate limiting fails open silently; `next start` got `WRONGPASS` with the local token |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | absent | File and image uploads |
| `BICTORYS_API_URL` | `test.bictorys.com` | Payments stay in test mode |
| `BICTORYS_API_KEY`, `BICTORYS_WEBHOOK_SECRET` | set (test keys) | Checkout and the payment webhook |
| `OPENROUTER_API_KEY` | set | Every AI feature (auto-tagging, descriptions, explain, optimize) |
| `AI_PROVIDER` / `AI_MODEL` | empty | Nothing: defaults to OpenRouter and its default model |
| `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DATABASE_URL` | set | Sign-in and everything else |

- [ ] Go through the table on Vercel and fill in what is missing.
- [ ] `DATABASE_URL` on Vercel points at the Neon `production` branch, not `develop`.
- [ ] Off Vercel only (e.g. `next start` on a server): set `AUTH_TRUST_HOST=true`, or every
  `/api/auth/*` call answers 500 `UntrustedHost`.

## 3. Domain and URLs

Everything points at `codstash.vercel.app` until a domain is bought. When `devcortex.dev` (or
another) is connected, all of these change together.

- [ ] Buy the domain and add it to the Vercel project.
- [ ] Update `APP_URL` and `AUTH_URL` on Vercel.
- [ ] Add `https://<domain>/api/auth/callback/github` to the GitHub OAuth app.
- [ ] Update the webhook URL in the Bictorys dashboard (`/api/webhooks/bictorys`).
- [ ] Verify the domain in Resend (SPF, DKIM) and update `EMAIL_FROM`.
- [ ] CLI: change `PRODUCTION_URL` in `cli/tsup.config.ts` and rebuild before publishing.

## 4. Third-party services

- [ ] **Bictorys:** switch from `test.bictorys.com` to live keys and the live API URL, then make one
  real payment and check that the webhook sets the plan to Pro.
- [ ] **Resend:** sending domain verified; send a verification email and a password reset to a real
  inbox.
- [ ] **Upstash:** the Vercel token works (sign-in blocks from the 6th failed attempt).
- [ ] **R2:** create a separate production bucket (dev and prod share one today) and set its
  `R2_*` variables on Vercel. Uploads whose item is never created stay orphaned in the bucket.
- [ ] **OpenRouter:** buy at least $10 of credits (without them, free routes are capped at 50
  requests a day for the whole account) and check the free routes' data policy. The provider stays
  OpenRouter until a switch is decided.
- [ ] **Vercel function duration:** the plan must allow the routes' `maxDuration`: 60 s (`/api/mcp`),
  120 s (AI explain and optimize, import, Gist import), 300 s (`/api/export`).

## 5. CLI `cortex`

- [ ] Replace the `@author-scope` placeholder in `cli/package.json` with the npm scope.
- [ ] Check `PRODUCTION_URL` (section 3).
- [ ] Run the postponed manual tests against `next dev`, in WSL and in cmd.exe: `login` (hidden
  input), variable prompts, the numbered pick, answering `N`, a command that reads stdin
  (`read -p "name: " n; echo "hi $n"`), Ctrl+C at a prompt, `get --copy` with accents, `save` from a
  pipe, `context -o`.
- [ ] From `cli/`: `npm install`, `npm run typecheck`, `npm run build`, then `npm publish --access public`.

## 6. After the deploy

Check each path once in production, with a real account:

- [ ] Sign up with email: verification email received, link works.
- [ ] Sign in with GitHub.
- [ ] Forgot password: reset email received, new password works, API tokens revoked.
- [ ] Create, edit and delete an item; upload a file and an image; download them.
- [ ] Upgrade to Pro with a real payment; Pro features unlock.
- [ ] One AI feature (e.g. auto-tagging) answers.
- [ ] Create an API token; `curl $CORTEX_URL/api/v1/me` answers; `cortex login` and `cortex search`
  work; the MCP endpoint answers in Claude Code.
- [ ] Export and import a collection.

## 7. Later

- The rename from CodStash to Cortex is not finished: "CodStash Pro" in the API's messages, the repo,
  the app's package name, the Neon and Vercel projects, the demo account `demo@codstash.io`. The
  `cstash_` token prefix stays.
- Still open from earlier features: password confirmation on account deletion (auth audit, Low); the
  Neon connection-pool setting (`idleTimeoutMillis`) to try on Vercel against slow first loads after an
  idle pause.

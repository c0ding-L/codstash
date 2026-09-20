# Auth Email Verification - Resend

## Overview

Require new email/password users to verify their email address before they can sign in. On registration a verification link is emailed with Resend; the account only works for credentials sign-in once the link has been clicked.

## Requirements

- Send the verification email with Resend (`resend` package, `RESEND_API_KEY` from `.env`)
- Registration creates the user with `emailVerified` unset and emails a single-use link
- Credentials sign-in is refused until the email is verified, with a clear message
- Clicking the link marks the user verified and sends them to sign-in
- An expired or already used link shows an error and a way to request a new one
- A "resend verification email" action for users who did not get it, or whose link expired
- GitHub sign-in is unaffected

## Registration (`POST /api/auth/register`)

- Same validation as today (passwords match, email format, minimum length, existing email)
- **Existing email, verified or not: the answer is still no, and the old account is never replaced or modified.** Two distinct 409 responses:
  - verified account (or a GitHub-only account): "An account with this email already exists." (as today)
  - unverified credentials account: "An account with this email already exists but has not been verified yet. Check your inbox, or send a new verification email." with a machine-readable `code` (e.g. `EMAIL_NOT_VERIFIED`) so the client can offer the resend action
- Create the user with `emailVerified: null`
- Generate the token, store it, send the email
- Return success telling the client to check the inbox
- If `resend.emails.send` returns an `error`, the user is still created; return a response that says the email could not be sent so the client can offer "resend"

## Verification Token

- Reuse the existing `VerificationToken` model (`identifier`, `token`, `expires`); no migration
- `identifier` is the lowercased email
- Generate with `crypto.randomBytes(32)`, send the raw value in the link, store only its SHA-256 hash
- Expires after 24 hours
- Single use: delete the row when it is consumed
- Creating a new token for an email deletes that email's earlier ones

## Verification Page (`/verify-email`)

- URL: `/verify-email?token=...&email=...`
- Server component with `await connection()` (all pages are server rendered and dynamic)
- Looks the token up by hash, checks expiry, sets `User.emailVerified = new Date()`, deletes the token
- Success: message plus a link to `/sign-in` (or redirect to `/sign-in` with a success toast)
- Invalid or expired: error message and the resend action

## Resend Endpoint

`POST /api/auth/resend-verification`

- Accept: email
- Always return the same generic success response whether or not the email exists or is already verified, so it cannot be used to probe for accounts
- Only sends for an existing, unverified user with a password
- Needs some throttling (see Notes)

## Sign-In Changes

- `authorize` in `src/auth.ts` refuses a user whose `emailVerified` is null, by throwing a `CredentialsSignin` subclass with its own `code` (e.g. `class EmailNotVerified extends CredentialsSignin { code = "email_not_verified" }`)
- **Check verification only after the password is correct.** The Auth.js docs advise against hinting which part of a login was wrong; throwing `EmailNotVerified` before `bcrypt.compare` would tell anyone that an email is registered
- `signInWithCredentials` (`src/actions/auth.ts`) currently maps every `CredentialsSignin` to "Invalid email or password". Because sign-in runs in a server action, the error is thrown there rather than put in the URL, so the action must look at `error.code` first and return a distinct state for `email_not_verified`
- `SignInForm` shows "Verify your email first" with a resend action for that case
- The redirect flow (`?error=CredentialsSignin&code=email_not_verified` on `/sign-in`) is the fallback when sign-in does not go through the action
- GitHub users keep working: the gate lives in the Credentials `authorize` only

## Register UI Changes

- The success toast from phase 3 ("Account created. You can now sign in.") becomes "Account created. Check your email to verify your account."
- Redirect to `/sign-in` as before
- When registration fails with `EMAIL_NOT_VERIFIED`, `RegisterForm` shows the message with a clickable "Send a new verification email" button (or link) that calls `POST /api/auth/resend-verification` with the email typed in the form and confirms with a toast; it does not clear the form

## Notes

### Email Sending

- Add the `resend` package
- Put the send logic in `src/lib/email.ts` (client, `sendVerificationEmail`), not inside the route
- `resend.emails.send({ from, to, subject, html })` **does not throw**: it resolves to `{ data, error }`, so check `error` explicitly. A `try/catch` alone would miss a failed send (`react` is also accepted for a React Email component; plain `html` is enough here, and `text` is generated from it if omitted)
- Simple HTML body with the link; no template library
- `RESEND_API_KEY` exists in `.env`, `.env.example` and `.env.production`. Two more values are needed and do not exist yet: a from address (e.g. `EMAIL_FROM`) and a base URL for the link (e.g. `APP_URL`, since `AUTH_URL` is not set). Add both to `.env.example`
- **Sender:** the Resend docs use `onboarding@resend.dev` for testing only; production email needs a domain verified in Resend, and a `from` address on a different domain fails with a 403 domain-mismatch error. The docs I could retrieve do not say who `onboarding@resend.dev` can deliver to, so confirm in the Resend dashboard before relying on it for real addresses
- Resend provides test recipients that exercise the send path without a real inbox: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, `suppressed@resend.dev`. They cannot be used to click the link, so end-to-end testing needs a real inbox (or reading the raw token another way in development)

### Existing Users

- Adding the gate would lock out any existing credentials user whose `emailVerified` is null. The seeded demo user is safe (the seed sets `emailVerified`)
- **Decided:** existing accounts are marked verified. `User.emailVerified` is a timestamp, so "verified" means setting it to the current date
- **Dev branch only.** The backfill runs against the Neon `develop` branch (the `DATABASE_URL` in `.env`). The `production` branch is never touched unless the author names it explicitly in that same message
- Do it with a one-off script, not a Prisma migration: a migration is applied by `prisma migrate deploy`, so it would silently run against production at deploy time. Production accounts are the author's separate, explicit decision
- The update only touches rows that need it: `emailVerified IS NULL AND password IS NOT NULL`. GitHub-only users (no password) are not affected by the gate and are left alone
- Report the number of rows updated, and check the result against the dev branch
- Users who signed up with GitHub are not affected by the gate

### Security

- Only the token hash is stored, so a database read does not yield usable links
- The token is bound to the email in the link; verify both
- A GET link that changes state can be consumed by email security scanners that prefetch links. If that turns out to happen, switch the page to show a confirm button that posts
- Verification closes the "register an email you do not own" gap flagged in the phase 2 review. **Decided:** an unverified account is not replaced when someone registers again with its email; the user is told the account exists and must be activated, and can request a new verification email. The trade-off: the registration response now tells apart "verified" from "unverified", on top of the existing 409 that already reveals an email is registered
- Rate limiting is still not implemented anywhere; the resend endpoint is the first place where it matters (it sends real emails). At minimum: one email per address per minute
- Keep the phase 2 hardening items (`P2002` race, password length cap, timing difference in `authorize`) in mind: the "unknown email vs wrong password vs unverified" responses should not make the timing leak worse

### Out of Scope

- Password reset (a separate feature that reuses the same token and email plumbing)
- Changing email address
- Branded email templates

## Testing

1. Register a new account with an address that can receive mail
2. Verify the toast says to check the email, and the user row exists with `emailVerified` null
3. Try to sign in before verifying, with the right password: refused with the "verify your email" message. With a wrong password: the normal "Invalid email or password" message, so an unverified account cannot be told apart
4. Check the inbox and click the link: lands on a success state, `emailVerified` is set, the token row is gone
5. Sign in with email/password: works, redirects to `/dashboard`
6. Click the same link again: error, not a second verification
7. Use an expired token (set `expires` in the past): error with the resend action
8. Resend from the sign-in form: a new email arrives, and the old link stops working
9. Resend for an unknown email: same generic response, no email sent
9a. Register again with the email of the unverified account: 409 with the "already exists but has not been verified" message and a resend button; the original user row is unchanged. Click the button: a new email arrives and the old link stops working
9b. Register with the email of a verified account: the plain "already exists" message, no resend button
10. Sign in with GitHub: still works
11. Sign in as `demo@codstash.io`: still works
12. `npm run build` lists `/verify-email` as `ƒ`
13. After the backfill on the dev branch, the previously unverified test accounts can sign in with email/password

## References

- Resend with Next.js (`emails.send`, `{ data, error }`): https://resend.com/docs/send-with-nextjs
- Resend 403 domain mismatch (the `from` domain must be verified): https://resend.com/docs/knowledge-base/403-error-domain-mismatch
- Resend end-to-end testing with test addresses: https://resend.com/docs/knowledge-base/end-to-end-testing-with-playwright
- Auth.js Credentials, custom error messages (`CredentialsSignin` with a `code`): https://authjs.dev/getting-started/providers/credentials
- Phase 2 spec: `@context/features/auth-phase-2-spec.md`; phase 3 spec: `@context/features/auth-phase-3-spec.md`

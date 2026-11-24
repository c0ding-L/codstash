# Auth Security Review

**Last audit:** 2026-10-05
**Auditor:** auth-auditor subagent
**Scope:** `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/actions/auth.ts`, `src/actions/profile.ts`, `src/app/api/auth/{register,resend-verification,forgot-password,reset-password}/route.ts`, `src/lib/verification.ts`, `src/lib/password-reset.ts`, `src/lib/db/profile.ts`, `src/lib/email.tsx`, `src/lib/email-verification-flag.ts`, `src/app/{verify-email,reset-password}/page.tsx`, `src/app/(app)/profile/page.tsx`, `prisma/schema.prisma`, `.gitignore`

## Summary

The token flows (verification and reset) and the profile actions are well built. The gaps are missing brute-force protection and sessions that outlive a password change. There is 1 High, 2 Medium and 2 Low finding.

## Findings

### [HIGH] No rate limiting on password guessing (sign-in, change-password, reset, register)

- **Location:** `src/auth.ts:30-48` (authorize), `src/actions/profile.ts:46`, `src/app/api/auth/reset-password/route.ts:38`, `src/app/api/auth/register/route.ts:65`
- **Issue:** A grep of `src/` for rate limiting finds only the per-email email-send throttles in `src/lib/verification.ts`, `src/lib/password-reset.ts` and `resend-verification/route.ts`. Those limit email spam, not guessing. `authorize()` does `bcrypt.compare(password, user.password)` with no attempt counter, and NextAuth does not limit the Credentials provider. `src/proxy.ts` only matches `/dashboard` and `/profile` and does no limiting. `/api/auth/callback/credentials` can be hit directly, so the server action is not the only entry point. The reset and register routes also run `bcrypt.hash(..., 12)` for every unauthenticated request. In reset-password this happens before the token is checked (line 38).
- **Attack scenario:** An attacker POSTs credentials for `victim@example.com` repeatedly from many IPs, or in a loop. The only cost to them is bcrypt latency, so they get unlimited online guessing against a known email. Sending many requests to `/api/auth/reset-password` or `/api/auth/register` with arbitrary data forces a cost-12 bcrypt hash each time, which exhausts CPU.
- **Fix:** Add a limiter keyed on normalised email plus IP, for example Upstash `@upstash/ratelimit` or a small Prisma-backed counter. Call it at the top of `authorize()` and return null when exceeded. Also call it at the top of the reset-password and register routes and in `changePassword`. For reset-password, validate the token before hashing: use `isPasswordResetTokenValid`, or hash after a cheap token lookup.

### [MEDIUM] Existing JWT sessions survive password change and password reset

- **Location:** `src/auth.ts:62-73`, `src/actions/profile.ts:50-57`, `src/lib/password-reset.ts:87-93`
- **Issue:** Sessions are JWTs (`session: { strategy: "jwt" }`). The `jwt` callback only does `if (user?.id) token.id = user.id`. The `User` model has no `passwordChangedAt` or token version, so nothing is checked on later requests. Changing or resetting the password only updates `password` and deletes tokens.
- **Attack scenario:** An attacker holds a stolen or forgotten session. The victim notices and resets their password. The attacker's JWT stays valid until it expires, which is the NextAuth default of 30 days. Resetting a password is the standard response to compromise, and it does not cut the attacker off.
- **Fix:** Add `passwordChangedAt DateTime?` to `User`. Set it in both `changePassword` and `resetPassword`. Store `token.iat` (or a `pwdAt` claim) at sign-in. In the `jwt` callback, which runs in the Node runtime in `auth.ts`, look the user up. Return null or an empty token if `user.passwordChangedAt > token.iat`. The proxy uses the edge config, so also check this in the `session` callback or in server-side `auth()` consumers. Note that `getProfile` already loads the user row on each profile request.
- **Reference:** https://authjs.dev/reference/nextjs (jwt callback)

### [MEDIUM] Registration reveals which emails have accounts

- **Location:** `src/app/api/auth/register/route.ts:47-59`
- **Issue:** An existing email gets `409 { error: "An account with this email already exists." }`. A new email gets `201`. When the account is unverified, the 409 also carries `code: "EMAIL_NOT_VERIFIED"`, which leaks account state. Forgot-password and resend-verification are correctly uniform (they run the lookup in `after()`).
- **Attack scenario:** `POST /api/auth/register` with `{name, email, password, confirmPassword}` for a list of target emails. A 409 means registered. A 201 creates an account as a side effect, so the check is only partly clean. Without rate limiting this can be run at scale.
- **Fix:** This is a trade-off, because the usual UX is to tell the user. If enumeration matters, return a uniform response, for example "If this email can be registered, we sent a link". Or at least rate-limit this route (see the High finding) and drop the `EMAIL_NOT_VERIFIED` code from the response.

### [LOW] Timing difference in sign-in reveals whether an email exists

- **Location:** `src/auth.ts:34-40`
- **Issue:** If the user is missing or has no password, `authorize` returns null immediately. Otherwise it runs `bcrypt.compare` at cost 12, which takes roughly hundreds of ms. The error text is the same for both ("Invalid email or password."), but the response time is not.
- **Attack scenario:** An attacker times sign-in attempts for candidate emails. Slow responses mean a password account exists.
- **Fix:** Compare against a constant dummy hash when there is no user or no password: `await bcrypt.compare(password, user?.password ?? DUMMY_HASH)`, and then return null.

### [LOW] Account deletion for password accounts needs no password

- **Location:** `src/actions/profile.ts:69-99`
- **Issue:** Confirmation is only typing the account's own email (`confirmEmail`). That value is already shown on the profile page (`profile/page.tsx:55`), so it is not a secret. Password accounts are not asked to re-authenticate, whereas `changePassword` does require the current password.
- **Attack scenario:** Anyone with a hijacked or unattended session (see the session finding above) can permanently delete the account and all its items. They read the email off the profile page and submit it.
- **Fix:** For `user.password` accounts, add a `password` field to the form, validate it in `deleteAccountSchema`, and run `bcrypt.compare(password, user.password)` before the transaction. Keep the email confirmation for GitHub-only accounts.

## Passed Checks

- ✅ Password hashing — bcryptjs cost 12 at every creation point: `src/app/api/auth/register/route.ts:8,65`, `src/app/api/auth/reset-password/route.ts:6,38`, `src/actions/profile.ts:10,53`.
- ✅ Server-side password minimum (8) in register, reset and change-password — `register/route.ts:40`, `reset-password/route.ts:31`, `profile.ts:21-23`. The bcrypt 72-byte truncation is silent but not exploitable here.
- ✅ Password hash never reaches the client — `authorize()` returns only `{id,name,email,image}` (`src/auth.ts:48`). `getProfile` strips `password` and returns `hasPassword` (`src/lib/db/profile.ts:24-25`). The register response selects `id,name,email` (`register/route.ts:67`). `session()` exposes only `user.id` (`auth.ts:69-72`).
- ✅ Email normalisation (trim + lowercase) is consistent in register, authorize, verify, reset, forgot and resend, and in token identifiers (`verification.ts:31,67`, `password-reset.ts:17,32,77`).
- ✅ Verification and reset tokens come from a CSPRNG with 256 bits of entropy (`randomBytes(32)`, `verification.ts:43`, `password-reset.ts:43`). They are stored as SHA-256 hashes (`hashToken`), and lookup is by hash.
- ✅ Expiry is enforced in the consuming query (`expires: { gt: new Date() }`, `verification.ts:70`, `password-reset.ts:80`). TTLs are 24h for verification and 1h for reset.
- ✅ Single use is atomic: `deleteMany` count is the guard (`verification.ts:69-72`, `password-reset.ts:79-82`). Older tokens are deleted when a new one is issued (`verification.ts:45`, `password-reset.ts:45`). `changePassword` also revokes pending reset tokens (`profile.ts:56`), and a reset drops verification tokens (`password-reset.ts:92`).
- ✅ Tokens are bound to the email (identifier in the delete query). Reset and verification identifiers cannot collide: `reset@<email>` has two `@`, and the `EMAIL_PATTERN` `[^\s@]` rejects that for any registered address.
- ✅ The reset page check is read-only (`isPasswordResetTokenValid` uses `findUnique`, `password-reset.ts:63-67`). Only the POST consumes the token.
- ✅ Reset and verification links are built from the `APP_URL` env var, not the Host header (`verification.ts:25`, `password-reset.ts:26`).
- ✅ Forgot-password and resend-verification respond identically for existing and non-existing emails. The lookup runs in `after()`. OAuth-only users are skipped (`forgot-password/route.ts:31`).
- ✅ Verification is enforced at sign-in after the password check (`auth.ts:44-46`). The flag defaults to on (`email-verification-flag.ts:6-8`).
- ✅ Profile actions call `auth()` themselves and use `session.user.id` only, with no user id from form data (`profile.ts:40-43,74-77`). Change-password requires the current password and refuses OAuth-only users (`profile.ts:44-48`). Delete runs in a transaction and calls `signOut`. The schema cascades `onDelete: Cascade` for Account, Session, Collection, Tag and ItemType. Items are deleted first because `Item.typeId` is Restrict. Tokens, which have no foreign key, are deleted explicitly.
- ✅ No mass assignment: Prisma `data` objects are built field by field.
- ✅ Profile queries are scoped by the session user id (`db/profile.ts:18-20,46-48`).
- ✅ No `allowDangerousEmailAccountLinking`. NextAuth's default blocks linking a GitHub login to an existing credentials account with the same email.
- ✅ `callbackUrl` handling goes through `safeRedirect` (`actions/auth.ts:22-28`). The `AUTH_*` and `APP_URL` secrets are read from the environment, and `.env*` is gitignored (`.gitignore:34`).

## Notes (unconfirmed)

- The default NextAuth JWT lifetime of 30 days is assumed in the session finding. `maxAge` is not set in this repo.

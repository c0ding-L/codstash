# i18n (French) — Phase 3: Errors, Auth and Emails

## Overview

Translate what the server returns or sends: server action and API route errors, zod messages,
the auth pages and the emails. Reference: `docs/i18n-plan.md` §5.2, §5.5 and §8. Requires Phase 2.

## Requirements

- **zod** (changed during implementation, 2026-11-25): the schemas stay at module level, and their
  messages are keys of the `errors` messages, typed with `errKey()` (`src/i18n/error-keys.ts`) so a
  typo fails the build. Each action translates the first issue with `getErrors().issue()`
  (`src/i18n/errors-server.ts`), which fills `{max}` / `{min}` from the zod issue. Factories were
  the first plan; keys change less code and keep the existing pattern.
  - Each field has its own whole sentence (« La description… », « Le langage… »), not a
    `{field}` template.
  - The limits are ICU `{max, number}`: "10,000" in English, "10 000" in French.
- **Action errors** (`src/actions/*.ts`): every `error: "…"` uses `t("errors.…")`.
  - Also `LIMIT_MESSAGES` in `src/lib/usage-limits.ts`.
- **API routes**: register, forgot-password, reset-password, resend-verification, upload and
  `items/[id]`, via `getTranslations` (the locale comes from the cookie).
- **Auth codes** (`src/lib/auth-errors.ts`): unchanged. The client maps `email_not_verified` and
  `rate_limited` to translated messages.
- **Public pages**: sign-in, register, verify-email, forgot and reset password, with an EN / FR
  toggle. It calls `setLocale`, which only writes the cookie when signed out.
- **Emails**:
  - The 3 templates take `locale`. Text and subjects come from `createTranslator` with the
    `emails` namespace.
  - `src/lib/email.tsx`: the send functions take `locale`.
  - Locale source:
    - the requester's cookie for verification, resend, forgot and reset;
    - the target `User.locale` for AccountExists, otherwise `en`. Registration saves the
      registrant's language in `User.locale`, so this is set for new accounts.

## Testing

- Action tests: mock `next-intl/server` with `getTranslations` returning
  `createTranslator({ locale: "en", messages: en, namespace })`.
  - Because `mockReset` is on, write it as a **plain async function** in the `vi.mock` factory,
    or set it in `beforeEach`.
  - The existing English assertions do not change.
- Add one FR case per family of errors: zod max length, Free limit, not found.
- `email` tests, if there are any: the subject and locale are correct for each path.
- In the browser, in FR: register, the verification email, a wrong password, forgot and reset
  password, and an action error (a too-long title).
- `npm test`, `npm run build` and `npm run lint` pass.

## Notes

- Branch: `feature/i18n-phase-3`.

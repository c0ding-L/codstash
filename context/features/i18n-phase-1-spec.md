# i18n (French) — Phase 1: Infrastructure and App Shell

## Overview

Add French next to English with next-intl, with no locale prefix in the URLs. This phase installs
the library, picks the locale on each request, stores the user's choice, adds the language
switcher, and translates the app shell: sidebar, top bar, user menu, item type labels and shared
buttons. The pages themselves stay in English until Phase 2.

Reference: `docs/i18n-plan.md` (§ numbers below point there). Decided with the author on
2026-11-25:
- no URL prefix
- `Accept-Language` on a first visit
- French uses **vous**
- type names are mixed: Snippet, Prompt, Note, Commande, Fichier, Image, Lien

Later phases:
- Phase 2 (`i18n-phase-2-spec.md`): app pages
- Phase 3 (`i18n-phase-3-spec.md`): errors, auth and emails
- Phase 4 (`i18n-phase-4-spec.md`): homepage and AI

## Requirements

### Library and config (§2)

- Install `next-intl` (4.x) **through Windows npm**:
  `cmd.exe /c "E: && cd \PROGRAMMING\CODE\codstash && npm install next-intl"`.
- `next.config.ts`: wrap the config with `createNextIntlPlugin()`. Keep the existing options.
- `src/proxy.ts` **does not change**. There is no locale routing, so next-intl needs no
  middleware.
- Before writing the code, read the next-intl "App Router without i18n routing" docs (Context7)
  and `node_modules/next/dist/docs/` on `cookies`.

### Locale resolution (§4.1)

- `src/lib/locale.ts` is pure and client-safe:
  - `LOCALES = ["en", "fr"] as const`, `type Locale`, `DEFAULT_LOCALE = "en"`, and
    `isLocale(value)`.
  - `LOCALE_COOKIE = "NEXT_LOCALE"`.
  - `resolveLocale({ cookie, userLocale, acceptLanguage })` returns `{ locale, source }`, where
    `source` is `"cookie" | "user" | "header" | "default"`.
  - Order: a valid cookie, then a valid `userLocale`, then `Accept-Language`, then `en`.
  - For `Accept-Language`, a small parser: sort by `q`, use the primary subtag (`fr-SN` → `fr`),
    take the first supported value.
- `src/i18n/request.ts`: `getRequestConfig` reads `cookies()` and `headers()`.
  - It reads `User.locale` **only** when there is no valid cookie and `auth()` returns a session.
  - It returns `locale` and `messages` (a dynamic import of `messages/<locale>.json`).
  - It must always return a `locale`. Without one, next-intl throws "Unable to find next-intl
    locale".

### Persistence (§4.2)

- `prisma/schema.prisma`: add `User.locale String?`. Null means "follow the cookie or the
  browser".
- Migration: `npx prisma migrate dev --name user_locale`, never `db push` and never the Neon MCP.
  - Before running it, check that the host of `DATABASE_URL` in `.env` is the Neon **develop**
    branch, without printing the URL.
  - Then run `prisma generate` and **ask before restarting the dev server**.
- `src/actions/locale.ts` → `setLocale(locale)`:
  - Validate with zod (`z.enum(LOCALES)`).
  - Set the `NEXT_LOCALE` cookie: 1 year, `sameSite: "lax"`, `path: "/"`.
  - If signed in, write `User.locale`.
  - Return `{ success }`, following the existing action pattern.
- **The cookie is never written during rendering.** The Next docs only allow `.set` in a Server
  Function or Route Handler. When `source === "user"` in `(app)/layout.tsx`, render
  `LocaleCookieSync`, a client component that calls `setLocale(locale)` once in a `useEffect`.
  That makes the DB read a one-off per device.

### Messages (§6)

- `messages/en.json` (the source) and `messages/fr.json`, with the same keys.
- Namespaces in this phase:
  - `common`: Save, Cancel, Delete, Edit, Close, Loading, …
  - `nav`
  - `userMenu`
  - `itemTypes`
  - `settings.language`
  - `metadata.root`
- Type the messages in `src/global.d.ts`: `declare module "next-intl" { interface AppConfig {
  Locale: Locale; Messages: typeof en } }`. A wrong key then fails the build.
- Keys describe a role, not the English text. French uses vous and French typography: a
  non-breaking space before `: ; ! ?`.

### Root layout

- `src/app/layout.tsx`:
  - `lang={await getLocale()}`
  - wrap the app in `NextIntlClientProvider`, passing **only** the namespaces client components
    need (`pick`)
  - turn the root `metadata` into `generateMetadata`

### App shell translation

- `AppSidebar`, `TopBar`, `UserMenu`, `UpgradeLink`, the search / command palette trigger,
  `AppSidebarSkeleton` (if it has text).
- System item types (§5.3):
  - Display them by slug through `itemTypes.<slug>.one` / `.other`. In FR: Snippet(s),
    Prompt(s), Note(s), Commande(s), Fichier(s), Image(s), Lien(s).
  - This replaces the plural labels hard-coded in `src/lib/item-type-ui.ts`.
  - Custom types keep their `name`.
  - URLs `/items/snippets`, … do not change.
  - Only the shell is in scope. The roughly 25 other `.name` reads in pages are Phase 2.

### Switcher (§4.3)

- `/settings`: a "Language" / "Langue" section next to the editor preferences, with a select or
  radio for English / Français. It calls `setLocale` and then `router.refresh()`.
- `UserMenu`: a short EN / FR entry. Same flow.
- The toggle on public pages is Phase 3 (auth) and Phase 4 (homepage).

## Files

| Action | File |
| ------ | ---- |
| create | `src/lib/locale.ts` + `locale.test.ts` |
| create | `src/lib/messages.test.ts` (key parity) |
| create | `src/i18n/request.ts` |
| create | `messages/en.json`, `messages/fr.json` |
| create | `src/global.d.ts` (or add to an existing one) |
| create | `src/actions/locale.ts` + `locale.test.ts` |
| create | `src/components/settings/LanguageForm.tsx`, `src/components/LocaleCookieSync.tsx` |
| create | `prisma/migrations/<ts>_user_locale/` |
| modify | `package.json`, `next.config.ts`, `prisma/schema.prisma` |
| modify | `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/settings/page.tsx` |
| modify | `AppSidebar.tsx`, `TopBar.tsx`, `UserMenu.tsx`, `UpgradeLink.tsx`, `src/lib/item-type-ui.ts` (+ test) |

## Testing

Mocks only. `mockReset` is on, so set return values in the test or in `beforeEach`. Run through
Windows npm.

- **`locale.test.ts`** (lib):
  - A valid cookie wins, and an invalid cookie is ignored.
  - The cookie beats `userLocale`, and `userLocale` beats `Accept-Language`. An invalid
    `userLocale` is ignored.
  - `Accept-Language`: `fr-FR,fr;q=0.9` → fr, `de,en;q=0.5` → en, `en;q=0.3,fr;q=0.8` → fr,
    `fr-CA` → fr, and an empty or missing header → en.
  - `source` is correct in each case.
- **`messages.test.ts`**:
  - `en.json` and `fr.json` have exactly the same keys, recursively.
  - No value is empty.
  - Each message has the same ICU placeholders (`{count}`, …) on both sides.
- **`actions/locale.test.ts`**: mock `next/headers` (`cookies`), `@/auth` and `@/lib/prisma`.
  - A valid locale sets the cookie with the right options.
  - Signed in: `User.locale` is updated. Signed out: no DB write.
  - An invalid value is rejected with no cookie and no write.
- **`item-type-ui.test.ts`**: update it if the label helpers change.
- `npm test`, `npm run build` and `npm run lint` pass.
- Browser (Playwright script):
  - Switch to FR in `/settings`, and the shell is in French.
  - Reload, and it is still French.
  - Sign out, delete the cookie, sign back in, and it is French again thanks to `User.locale`.
    The cookie is rewritten.
  - A new browser with `Accept-Language: fr` shows the public pages with `lang="fr"`. Their
    content is still in English until Phase 3 and 4.

## Notes

- Pages, toasts, action errors, emails, the homepage and the AI stay in English in this phase. Mixed
  French and English inside pages is expected until Phase 2.
- The production DB is off-limits. The author applies the production migration.
- Branch: `feature/i18n-phase-1`.

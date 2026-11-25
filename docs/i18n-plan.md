# Internationalization Plan: French

Research for adding French next to English in CodStash. English stays the default language and the
source of every message. This document proposes a library, a routing model and four phases, one
branch each. It ends with the decisions the author has to make.

Research date: 2026-11-25. Codebase at `b201b16`.

---

## 1. Summary of the recommendation

| Topic | Recommendation |
| --- | --- |
| Library | **next-intl 4.x** (4.16.2 today), with no i18n routing |
| URLs | **No locale prefix.** URLs stay `/dashboard`, `/items/snippets` and so on |
| Locale source per request | `NEXT_LOCALE` cookie, then `User.locale` (no cookie), then `Accept-Language`, then `en` |
| Persistence | New `User.locale` column (migration), read when there is no cookie |
| Switcher | Settings page, plus the user menu in the top bar, plus a small toggle on public pages |
| Message files | `messages/en.json`, `messages/fr.json`, namespaced by area |
| Tests | Key-parity test for the catalogs, `resolveLocale` util tests, a `setLocale` action test |
| Phasing | 1) infrastructure and app shell, 2) app pages, 3) errors, auth and emails, 4) homepage and AI |

---

## 2. Library choice

### 2.1 Options

**A. next-intl (recommended).**
- Verified on npm on 2026-11-25: version `4.16.2`. Peer dependencies are
  `next: ^12 || ^13 || ^14 || ^15 || ^16` and `react: ^19.0.0`, which covers Next 16.4.6 and React
  19.2.4.
- It has an official setup without a `[locale]` segment, the "App Router without i18n routing"
  example. In that setup `src/i18n/request.ts` reads the locale from a cookie in
  `getRequestConfig`.
- The same API works in Server Components (`getTranslations`), Client Components
  (`useTranslations`), Server Actions, Route Handlers and `generateMetadata`.
- It covers ICU plurals and select, typed keys (the `AppConfig` augmentation),
  `useFormatter`/`getFormatter` for dates, numbers and relative time, and rich text with
  components.
- Setup is a `next.config.ts` plugin (`createNextIntlPlugin()`). It works with Turbopack, which is
  the default build in Next 16.
- When locale routing is off, no proxy or middleware is needed. The docs say that in that case
  `getRequestConfig` must return a `locale` itself. Otherwise you get the error "Unable to find
  next-intl locale because the proxy / middleware didn't run". The existing `src/proxy.ts` (the
  NextAuth gate) does not change.

**B. Hand-rolled dictionaries (the pattern in the Next docs guide).**
- `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` describes JSON
  dictionaries, a `getDictionary()` with `import 'server-only'`, and `next/root-params` to read the
  locale.
- `next/root-params` only exists when every route is nested under `app/[lang]`. Without a prefix it
  does not apply.
- That pattern is server-only. CodStash has **71 client components** (`'use client'`), so we would
  have to build our own context provider, plurals, interpolation, formatting and typed keys. That
  means rebuilding next-intl by hand, against the "preserve patterns, minimal code" rule.

**C. Others (react-i18next, Lingui, Paraglide).** All are workable. None of them has a first-party
App Router + Server Actions story as direct as next-intl's, and Lingui and Paraglide add a compile
step. Not worth the change.

### 2.2 Cost

- One runtime dependency (`next-intl`, which pulls in `use-intl` and `@formatjs/*`).
- Client bundle: only what we pass to `NextIntlClientProvider`. The plan passes **only the
  namespaces client components need**, not the whole catalog (see §6).

---

## 3. Routing: prefix or no prefix

### 3.1 With a `/fr/...` prefix
- Every route under `src/app/` moves into `src/app/[locale]/` (29 pages, layouts and routes,
  including `(app)`). The root layout moves too.
- `src/proxy.ts` must chain next-intl's middleware with the NextAuth gate, and its `matcher`
  (`/dashboard/:path*`, …) must allow for the prefix.
- Every `href`, `redirect()`, `router.push`, NextAuth's `callbackUrl`, the sign-in redirect, email
  links (verify, reset), the Bictorys return URL and `itemTypeHref()` must keep the prefix. This
  touches most navigation code.
- Benefit: indexable French URLs and `hreflang`. That only matters for public pages: the homepage,
  and maybe sign-in and register. Everything behind sign-in is private and not indexed.

### 3.2 No prefix (recommended)
- The URLs do not change. The locale comes from the cookie. Calling `getLocale()` in the root
  layout makes every route dynamic. Checked: `src/app/page.tsx` and the public pages (sign-in,
  register, forgot and reset password, verify-email) already call `connection()`, and so do the
  `(app)` pages. The one route that changes is `/_not-found`: Next prerendered it, and after Phase
  1 it renders per request (`ƒ` in the build). The cost is small: a 404 is rendered on the
  server, plus one `auth()` call when there is no cookie.
- No change to the proxy, links, redirects or email URLs.
- Downside: no separate French URL for the homepage to be indexed. If SEO for the marketing page
  matters later, we can add `/fr` for the homepage alone, without moving the app.

---

## 4. Choosing the locale

### 4.1 Order, for each request
1. `NEXT_LOCALE` cookie, if it holds a supported value (`en` | `fr`).
2. Signed in with no cookie (a new device): `User.locale`, read from the DB.
3. `Accept-Language`: the first supported language with the highest `q`. `fr-FR`, `fr-SN` and
   `fr-CA` map to `fr`.
4. `en`.

Put this in a pure function `resolveLocale({ cookie, userLocale, acceptLanguage })` in
`src/lib/locale.ts` so it can be unit-tested. `src/i18n/request.ts` calls it with `cookies()` and
`headers()`. It reads `User.locale` only when the cookie is missing and a session exists. To make
that a one-off per device, `(app)/layout.tsx` renders a small client component
(`LocaleCookieSync`) whenever the locale came from `User.locale` with no cookie. It calls
`setLocale(locale)` once in an effect, which writes the cookie through a Server Function. From
the next request on, the cookie is there and the DB is no longer read for the locale. A small
hand-written `Accept-Language` parser is enough for two locales. `negotiator` and
`@formatjs/intl-localematcher` are not needed.

### 4.2 Persistence
- Add the column `User.locale String?`. Null means "follow the cookie or the browser". It goes
  through **`prisma migrate dev`**, never `db push` and never the Neon MCP.
- Server action `setLocale(locale)` in `src/actions/profile.ts` (or a new `src/actions/locale.ts`):
  - validates with zod,
  - sets the cookie (1 year, `sameSite: lax`, `path: /`),
  - saves `User.locale` when signed in,
  - calls `revalidatePath('/', 'layout')` or `router.refresh()` on the client.
- **The cookie is never written during rendering.** The Next docs (`cookies` API reference) say
  `.set` only works in a Server Function or a Route Handler, and that setting a cookie during
  Server Component rendering is not supported. So `getRequestConfig` and the layouts **read**
  only. That is why step 2 of §4.1 exists: on a new device, `User.locale` takes over, and
  `LocaleCookieSync` then writes the cookie through `setLocale`. This works for Credentials and OAuth sign-in alike.
- Rejected alternatives:
  - Writing the cookie in the Credentials sign-in action. It does not cover OAuth.
  - Writing it in the NextAuth `events.signIn`. That runs inside `/api/auth`, but setting a cookie
    there is not verified.
  - Putting `locale` in the JWT. That changes the session.
- `User.locale` is also the source for emails sent **to someone other than the requester**. Today
  that is `AccountExistsEmail`: someone registers with an existing address, and the owner of that
  address gets the email.
- Registration also saves `User.locale` (the request's language), set in Phase 3. Without it, an
  owner who never used the switcher stays null and gets that email in English.

### 4.3 Where the switcher goes
- `/settings`: a "Language" section next to the editor preferences. This is the main control.
- The user menu in the top bar: a short `EN / FR` entry, for quick access.
- Public pages (homepage, sign-in, register, forgot and reset password): a small toggle in the
  header or footer. It writes the cookie only.
- As built: the homepage's `HomeNav` carries the toggle, and `/sign-in` and `/register`, which show
  `HomeNav`, hide the one under their card (`AuthCard` shows it only without the nav). Forgot and
  reset password keep the card's toggle; `/verify-email` has none (switching refreshes the page,
  which would spend its token again).

---

## 5. Inventory: what to translate

Counts measured with grep on `src/` at `b201b16`. They are estimates, ±20 %.

| Surface | Measure | Notes |
| --- | --- | --- |
| `.tsx` files | 139, including 71 client | Roughly 90 of them hold visible text |
| Plain text lines in JSX | ~340 | Headings, labels, empty states, buttons |
| String attributes (`placeholder`, `aria-label`, `title`, `alt`, `label`, `description`) | ~100 | |
| `toast(...)` calls | 42 | Sonner, in client components |
| `error:` messages in actions, API routes and lib | ~80 unique | Returned to the client and shown as is |
| zod messages (`message:`, `.max(…, "…")`) | ~85 unique | Schemas are **at module level**, see §5.2 |
| `metadata` / `generateMetadata` exports | 11 | Page titles |
| react-email templates | 3 | Verification, PasswordReset, AccountExists, plus their subjects in `src/lib/email.tsx` |
| System item types | 7 | `ItemType.name` in the DB, plural labels in `src/lib/item-type-ui.ts` |
| Hard-coded locale formatting | 7 places | `en-US` in `billing-plans.ts`, `profile/page.tsx`, the zod `toLocaleString("en-US")` calls |
| Homepage | ~570 lines in `src/components/home` | Marketing text, the longest single block |
| AI prompts | 4 system prompts | `src/lib/ai-prompts.ts` |

**Total: about 700 strings.** That is too much for one branch, hence the phases in §8.

### 5.1 Layout and metadata
- `src/app/layout.tsx` hard-codes `lang="en"`. Replace it with `lang={await getLocale()}` and wrap
  `children` in `NextIntlClientProvider`.
- The 11 static `metadata` exports become `generateMetadata()` with
  `getTranslations('metadata')`.

### 5.2 Errors in server actions and zod
- Schemas are declared at module level with English messages. Examples: `items.ts:59` builds
  `` `${label} can be at most …` `` and `ai.ts:57` has `Content can be at most …`.
- **Done in Phase 3 differently:** the schemas keep keys of the `errors` messages as their zod
  messages (typed with `errKey()`), and the action translates the first issue. See
  `context/features/i18n-phase-3-spec.md`.
- First recommendation (not used): turn each schema into a factory, for example
  `itemSchema(t: Translator) => z.object(...)`. The action calls
  `const t = await getTranslations('errors')` and then `itemSchema(t).safeParse(...)`.
  The alternative is to keep the schemas and return **keys** that the client translates. That is
  more invasive on the client and loses the interpolated values.
- `error: "…"` messages in the actions use `t('errors.xxx')`.
- `src/lib/auth-errors.ts` holds **codes** (`email_not_verified`, `rate_limited`). The client maps
  these to translated messages. Its structure stays the same.
- API routes (`/api/auth/register`, `forgot-password`, `reset-password`, `resend-verification`,
  `upload`, `items/[id]`): `getTranslations` works in Route Handlers too. The locale comes from the
  request cookie.

### 5.3 Item types
- System types (`isSystem = true`): display the **translated name by slug**, with keys
  `itemTypes.snippet.one` / `.other` and so on, instead of `ItemType.name`. That covers about 25
  places that read `.name` in components, plus the plural labels in `item-type-ui.ts` (the
  sidebar).
- Pro users' custom types: display their `name` as typed, untranslated.
- URLs `/items/snippets`, … stay in English (the segments come from `itemTypeHref()`).
- The DB and the seed do not change. Demo collections and items are user data and stay as they
  are.

### 5.4 Dates, numbers, currencies
- `src/lib/format.ts` `formatRelativeTime` builds `"3d ago"` by hand. In French: `"il y a 3 j"`.
  Make it take the locale, or move it to ICU messages
  (`{count, plural, one {# j} other {# j}}`). Update its tests.
- `billing-plans.ts`: replace the hard-coded `en-US` with the locale. XOF already uses `fr-FR`
  ("FCFA").
- `profile/page.tsx` (`memberSince`) and `billing-plans.ts:90`: use the locale.
- `ItemDetails.tsx:37` uses `toLocaleDateString(undefined, …)`. With `undefined` the server and
  the client can render different text (hydration risk). Pass the locale explicitly, or use
  `useFormatter()`.
- `favorites-sort.ts` (`Intl.Collator(undefined)`) and the `localeCompare` calls: sort order is
  the same for `en` and `fr` in practice. No change needed.

### 5.5 Emails
- The templates take a `locale` prop and a messages object (`createTranslator` from `next-intl`
  works outside React, with no request context).
- `src/lib/email.tsx`: subjects get translated too, and the send functions take a `locale`.
- Where the locale comes from:
  - register, verification, resend-verification, forgot-password: the **requester's cookie**,
    because they are not signed in.
  - AccountExists: the target `User.locale`, otherwise `en`.

### 5.6 AI
- The system prompts stay in English: models follow instructions best in English, and this keeps
  the tests stable.
- The output language is an author decision (§9). Proposal:
  - **Explain** and **Description**: answer in the UI language. Add one line to the system prompt
    ("Write the answer in French.") when `locale === 'fr'`.
  - **Optimize prompt**: keep the prompt's own language. The user is rewriting their own prompt.
  - **Tags**: follow the content's language. That is the current behavior, no change.
- `ai-prompts.test.ts` gets one case per locale.

### 5.7 Not translated
- User content: items, collections, tags, custom types.
- Monaco (the editor UI is in English), the names of programming languages, file names.
- Webhook routes (Bictorys) and server logs.

---

## 6. Message catalog structure

```
messages/
  en.json       # source, written first
  fr.json       # same keys
src/i18n/
  request.ts    # getRequestConfig: resolveLocale + import(`../../messages/${locale}.json`)
src/lib/
  locale.ts       # LOCALES, DEFAULT_LOCALE, isLocale, resolveLocale
  locale.test.ts
  messages.test.ts  # key parity en/fr (+ no empty values, same ICU placeholders)
```

- **Namespaces** by area: `common`, `nav`, `metadata`, `itemTypes`, `items`, `drawer`,
  `collections`, `dashboard`, `favorites`, `search`, `profile`, `settings`, `billing`, `upgrade`,
  `auth`, `home`, `errors`, `emails`, `toasts`.
- **Keys**: camelCase, describing the role rather than the English text
  (`items.empty.title`, not `items.noSnippetsYet`).
- **Typing**: augment `AppConfig` with `Messages: typeof en` in a `global.d.ts`. A wrong key then
  fails `npm run build`.
- **Client**: `NextIntlClientProvider` in the root layout gets
  `pick(messages, CLIENT_NAMESPACES)`. Server-only namespaces (`metadata`, `emails`, `errors`) are
  never sent to the browser.
- **French style**: one tone for the whole app (see §9, tu or vous), a glossary at the top of the
  PR, French typography (non-breaking space before `: ; ! ?`, `«  »` quotes).

---

## 7. Testing

Following the project rule (Vitest, `src/lib` and `src/actions` only, no components):

- `src/lib/messages.test.ts`: `en.json` and `fr.json` have exactly the same keys, no empty value,
  and the same ICU placeholders (`{count}`, `{max}`) on both sides.
- `src/lib/locale.test.ts`: `resolveLocale` covers:
  - a valid cookie and an invalid cookie;
  - the cookie beats `userLocale`, `userLocale` beats `Accept-Language`, and an invalid
    `userLocale` is ignored;
  - `Accept-Language` with `q`, `fr-CA` → `fr`, `de` → `en`, and an empty header.
- `src/actions/*.test.ts`: mock `next-intl/server`. `getTranslations` returns a translator built
  with `createTranslator({ locale: 'en', messages: en })`, so the existing assertions on English
  messages keep passing. Because `mockReset` is on, write it as a **plain async function** in the
  `vi.mock` factory (not as a `vi.fn()` with an implementation), or set it in `beforeEach`.
  Otherwise it is cleared before each test. Add a `setLocale` test (cookie set, `User.locale` written only for a
  signed-in user, invalid value rejected).
- `src/lib/format.test.ts` and `billing-plans.test.ts`: add `fr` cases.
- Browser (Playwright script): switch to FR in settings, reload, sign out and back in, and check
  that the language comes back.

---

## 8. Phases (one branch each)

### Phase 1: Infrastructure and app shell (`feature/i18n-foundation`)
- `npm install next-intl` (through Windows npm), the plugin in `next.config.ts`,
  `src/i18n/request.ts`, `messages/en.json` and `fr.json`, `src/lib/locale.ts`, and the typed
  `AppConfig`.
- Migration `User.locale`, the `setLocale` action, `LocaleCookieSync`, the switcher in
  `/settings` and the user menu.
- `layout.tsx`: dynamic `lang`, the provider. Translate the shell: sidebar, top bar, user menu,
  item type labels (§5.3), command palette / search, `common` (Save, Cancel, Delete, …).
- Tests: parity, `resolveLocale`, `setLocale`.
- **Done when** switching to FR translates the whole shell, the choice survives sign-out and
  sign-in, and test, build and lint pass.

### Phase 2: App pages (`feature/i18n-app-pages`)
- Dashboard, item lists, drawer (view and edit), create dialog, collections, favorites, profile,
  settings, billing, upgrade, Pro upsell cards, empty states.
- The 42 toasts, the 11 metadata exports, dates, numbers and currencies (§5.4).
- **Done when** no English text is left on the signed-in pages in FR (checked by hand and with a
  grep for the `t(` calls), and test, build and lint pass.

### Phase 3: Errors, auth and emails (`feature/i18n-errors-auth-emails`)
- zod schemas as factories, `error:` messages in actions and API routes, mapping of the auth codes.
- Sign-in, register, verify-email, forgot and reset password pages, plus the public toggle.
- The 3 emails and their subjects, with the locale chosen as in §5.5.
- **Done when** each action error and each email exists in FR, the action tests pass with the
  mocked translator, and test, build and lint pass.

### Phase 4: Homepage and AI (`feature/i18n-home-ai`)
- Translate `src/components/home` (marketing text) and its metadata.
- AI output language as decided in §9.
- **Done when** the homepage is in FR with the toggle, the AI answers in FR where planned, and
  test, build and lint pass.

Each phase becomes an entry in `context/current-feature.md`, documented and then approved before
any code is written.

---

## 9. Decisions for the author

**Decided 2026-11-25:** 1 = no prefix, 2 = `Accept-Language`, 4 = vous, 5 = mixed (Snippet,
Prompt, Note, Commande, Fichier, Image, Lien). Items 3, 6 and 7 follow the recommendation unless
the author says otherwise.

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| 1 | Routing | No prefix (cookie + DB) / `/fr` prefix on everything / `/fr` on the homepage only | **No prefix** |
| 2 | First visit with no cookie | `Accept-Language` / always English | **`Accept-Language`** |
| 3 | Switcher placement | Settings / user menu / public pages (several allowed) | **All three** |
| 4 | Tone | Vous / tu | **Vous** (standard for a SaaS app). Tu also works for a dev tool. |
| 5 | System type names in FR | Translate (Extrait, Prompt, Note, Commande, Fichier, Image, Lien) / keep the English terms | Translate, but keep **Snippet** and **Prompt** as they are (common terms among French-speaking developers) |
| 6 | AI output language | Follows the UI (explain, description) / always the content's language | **Follows the UI for explain and description**, content language for tags and optimize |
| 7 | Who writes the French | Claude drafts, the author proofreads / the author writes | Claude drafts, the author proofreads |

---

## Sources

- `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`, the Next 16.4.6 guide
  (prefixed routing, dictionaries, `next/root-params`)
- next-intl docs on Context7 (`/amannn/next-intl`): "App Router without i18n routing",
  `getRequestConfig`, plugin, middleware troubleshooting
- [next-intl: proxy / middleware](https://next-intl.dev/docs/routing/middleware)
- [Next.js: Proxy (formerly Middleware)](https://nextjs.org/docs/app/getting-started/proxy)
- [Build with Matija: next-intl + Next 16 proxy fix](https://www.buildwithmatija.com/blog/next-intl-nextjs-16-proxy-fix)
  (secondary source: return `locale` from `getRequestConfig`)
- `npm view next-intl` (version 4.16.2, peer dependencies), 2026-11-25
- Codebase: `src/app/**`, `src/components/**`, `src/actions/**`, `src/lib/**`, `src/emails/**`,
  `src/proxy.ts`, `prisma/schema.prisma`, `prisma/seed.ts`

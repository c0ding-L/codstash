# Internationalization (French) Research

## Output

docs/i18n-plan.md

## Research

Plan how to add French alongside English to CodStash (Next.js 16.4.6 App Router, React 19.2,
server-rendered dynamic pages with `await connection()`, NextAuth v5, Prisma 7 on Neon, Resend +
react-email). English stays the default and the source language. Produce an implementation plan
split into phases small enough for one branch each, and list the decisions the author must make,
each with options and a recommendation.

## Include

- **Library choice**: `next-intl` vs a hand-rolled dictionary approach (as in the Next docs guide)
  vs others. Verify — do not assume — that the chosen library supports Next 16.4 + React 19.2,
  Turbopack, Server Components, server actions, and the App Router **without** a `[locale]`
  segment. Bundle/runtime cost, typed keys, ICU plurals.
- **Routing options**: `/fr/...` locale prefix (moves `src/app/(app)` under `[locale]`, proxy /
  middleware, SEO on public pages) vs no prefix (cookie + `User.locale`). Cost of each in this
  codebase. Recommendation.
- **Locale resolution order**: user preference → cookie → `Accept-Language` → `en`. Where the
  switcher lives (settings, top bar, homepage, auth pages).
- **Persistence**: `User.locale` column via `prisma migrate dev` (never `db push`, never the Neon
  MCP). Syncing cookie and DB on sign-in.
- **Inventory of surfaces to translate**, with counts measured by grep:
  - UI strings in components and pages (JSX text, `placeholder`, `aria-label`, `title`)
  - toasts (`sonner`), server-action and API route error messages, zod messages,
    `src/lib/auth-errors.ts`
  - `layout.tsx` `lang="en"` and `metadata` titles/descriptions per page
  - system item type names (`ItemType.name` rows with `isSystem`) — translate the display name by
    slug, keep the `/items/[type]` URLs and custom types as they are
  - dates, numbers, currencies (`src/lib/format.ts`, billing, exchange rates) via `Intl`
  - the three react-email templates; register / forgot-password / resend-verification run
    unauthenticated, so their locale comes from the cookie or `Accept-Language`
  - AI prompts (`src/lib/ai-prompts.ts`): whether explain / optimize / description answer in the
    UI language; tags likely follow the content language
  - homepage (public marketing page) and auth pages
- **Message catalog structure**: file layout, namespaces, key naming, how client components get
  only the messages they need.
- **Testing**: a Vitest key-parity test (en/fr catalogs have identical keys) and any locale
  resolution util tests, within the rule that only `src/lib` and `src/actions` are tested.
- **Phasing**: e.g. 1) infrastructure + switcher + layout/nav, 2) app pages, 3) emails, errors,
  AI. Each phase with its files, steps and done criteria.
- **Open decisions** for the author, with options and a recommendation.

## Sources

- `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` (required by AGENTS.md)
- Context7 docs and web search for `next-intl` (current version, Next 16 support, "without i18n
  routing" setup) and alternatives
- `context/project-overview.md`, `context/coding-standards.md`
- `src/app/**`, `src/components/**`, `src/actions/**`, `src/lib/**`, `src/emails/**`,
  `prisma/schema.prisma`, `prisma/seed.ts`

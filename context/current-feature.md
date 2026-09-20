# Current Feature

## Status

Not Started

## Goals

<!-- Bullet points of what success looks like -->

## Notes

<!-- Additional context, constraints, or details from spec -->

---

Previous feature (completed) — Auth Credentials, phase 2: Credentials provider
and `POST /api/auth/register`. Spec: `@context/features/auth-phase-2-spec.md`;
phase 3 (sign-in / register UI) is still to do. Outcome in the History below.

---

Previous feature (completed) — Auth Setup, phase 1: NextAuth v5 with the GitHub
provider, the Prisma adapter and JWT sessions, and `/dashboard/*` protected by the
Next 16 proxy. Spec: `@context/features/auth-phase-1-spec.md`; phases 2
(Credentials + registration) and 3 (sign-in / register UI) are still to do.
Outcome in the History below.

---

Previous feature (completed) — Errors, Limits & Indexes — error boundaries with
a retry button, query limit validation, and two query indexes. The loading-state
skeleton was built and then deferred; its plan is in the History below.

---

Previous feature (completed) — Scanner Quick Wins — `code-scanner` findings:
`groupBy` type counts, request-scoped `cache()`, and `formatRelativeTime`
requiring `now`. Outcome in the History below.

---

Previous feature (completed) — Add Pro Badge to Sidebar.
Spec: `@context/features/add-pro-badge-sidebar.md` — outcome in the History
below.

---

Previous feature (completed) — Stats & Sidebar — real item types and
collections in the sidebar.
Spec: `@context/features/stats-sidebar-spec.md` — the decision and its outcome
are in the History below.

---

Previous feature (completed) — Dashboard Items.
Spec: `@context/features/dashboard-items-spec.md` — the decision and its outcome
are in the History below.

---

Previous feature (completed) — Dashboard Collections.
Spec: `@context/features/dashboard-collections-spec.md`.

## Goals

Swap the recent-collections cards on `/dashboard` off `src/lib/mock-data.ts` and
onto the seeded Neon rows via Prisma. The layout stays exactly as it is.

- `src/lib/db/collections.ts` holds the fetching functions
- The dashboard server component queries directly, per `coding-standards.md:29`
- Each card's accent comes from the most-used item type in that collection
- Each card shows small icons for every type present in the collection
- Collection stats (the section count, each card's item count) come from the
  database
- Items underneath are explicitly out of scope — `PinnedItems`, `RecentItems`
  and `StatsCards` keep reading the mock

## Notes

### The blocker to settle first

**Nothing knows who the current user is.** NextAuth is installed but not
configured — there is no `auth.ts`, no session — while `Collection.userId` is
required. The proposal: `src/lib/db/collections.ts` takes `userId` as a
parameter, and a single `getDemoUserId()` (looking up `demo@codstash.io`, the
seeded address) supplies it. That keeps the shim to one function to delete when
auth lands, instead of scattering the demo email through the queries. It is a
temporary stand-in, not a design.

### Adaptations of the spec

- **"6 cards" does not match anything.** The mock's `recentCollections` slices
  to 5 (`mock-data.ts:720`) and the seed created exactly 5 collections. The
  section will render what exists — 5 today. Nothing gets padded.
- **"Most-used content type" means the item *type*** (snippet / prompt / …),
  not `Item.contentType`, which is the unrelated `"text" | "file"` column. The
  schema has no `primaryTypeId`; the mock did. It has to be derived by counting
  items per `typeId` within each collection. Ties break by a stable rule (the
  type whose slug sorts first) so the colour does not flip between renders, and
  a collection with no items falls back to the neutral styling the card already
  uses when `typeById` misses.
- **The wash/ring colours have to be adapted, not copied.**
  `@context/features/item-type-card-color-handler.md` specifies
  `bg-snippet/[0.06]` and `hover:border-snippet/40`, which need `--snippet`-style
  OKLCH tokens in `globals.css`. Those tokens **do not exist** — checked; the
  `@theme inline` block holds only shadcn's. The plan is to extend
  `src/lib/item-type-ui.ts` with `washClasses` and `ringClasses`
  (`Record<ColorToken, string>`) alongside the existing `colorClasses` /
  `surfaceClasses`, spelled out literally per that document's own §5 warning
  that Tailwind v4 cannot see interpolated class names. Same precedent as the
  seed feature: the `ColorToken` words are what the code consumes.
- **Small icons for every type in a collection is a new element**, not a port —
  the current card shows one icon for the dominant type only.
- `Collection.description` is nullable in Prisma but non-null in the mock's
  interface, so the card has to handle `null`.

### Consequences worth expecting

- **`/dashboard` stops being static** — but not on its own. A Prisma query is
  invisible to Next's static analysis, so the route keeps prerendering (`○`)
  and bakes the rows in at build time unless something opts it out. `await
  connection()` does that; the build then reports `ƒ`. Verified, after the
  first build proved the opposite.
- **`formatRelativeTime` defaults to `MOCK_NOW`** (`format.ts:17`), which is
  2026-08-01. Real rows measured against it would produce wrong labels, so the
  call site must pass a real `now`. `format.ts` importing `MOCK_NOW` from
  `mock-data.ts` is a coupling that should go when the last mock consumer does;
  whether to break it now is a judgement call to make during implementation.
- **`typeById` in `item-type-ui.ts` reads the mock's `itemTypes`.** The icon and
  colour lookup has to come from the database rows (or a slug-keyed map)
  instead. Easy to miss — the component's imports look innocent.
- One `findMany` with `items: { select: { typeId: true } }` and aggregation in
  JS avoids an N+1 across 5 collections without `groupBy` gymnastics.

### Scope boundary

"Update collection stats display" is read narrowly: the section header count and
each card's item count, from `_count`. The four `StatsCards` at the top read
`dashboardStats` and mix in item and favorite totals that are not collections —
converting those is a separate feature.

---

Previous feature (completed) — Root redirect. `/` sends visitors to
`/dashboard`; the decision and outcome are in the History below.

---

Previous feature (completed) — Seed Data.
Spec: `@context/features/seed-spec.md`. Its notes follow.

## Goals

Fill the empty database the previous feature created, so the UI has something
real to read once it stops importing `src/lib/mock-data.ts`.

- `prisma/seed.ts`, run with `tsx`, wired as `npm run db:seed` and as
  `migrations.seed` in `prisma.config.ts`
- 1 demo user (`demo@codstash.io`, password hashed with bcryptjs, 12 rounds)
- The 7 system item types
- 5 collections and 18 items, per the spec's per-collection breakdown
- Idempotent: running it twice leaves the same row counts

## Notes

Adaptations of the spec, and the reasoning:

- **`ItemType.color` stores the mock's colour tokens** (`emerald`, `amber`,
  `blue`, `cyan`, `rose`, `violet`, `yellow`), not the OKLCH values or the
  Tailwind class strings from `@context/features/item-type-card-color-handler.md`.
  That document describes a later, different design; the tokens are what
  `src/lib/item-type-ui.ts` actually keys `colorClasses` / `surfaceClasses` by,
  so they are the shapes the code consumes today. Icons are stored as the
  lucide component names already used by the mock.
- **`ItemType` has no `pluralName` column.** The sidebar derives its route from
  `pluralName.toLowerCase()` in the mock, so that mapping has to live in the UI
  (or the column has to be added) whenever the switch-over happens. Not
  invented here.
- **System types get explicit stable ids** (`typ_snippet`, …, matching the
  mock) and are upserted on `id`. The schema's `@@unique([userId, slug])` does
  not constrain them: `userId` is null for system types, and NULLs do not
  collide in a PostgreSQL unique index, so an upsert keyed on that pair would
  create a duplicate on every run.
- **Only the demo user is deleted.** `Item.typeId` is `onDelete: Restrict`, so
  deleting a system item type would fail as soon as any user owns an item of
  that type — the types are upserted on their fixed id instead and never
  removed. The single delete is scoped to `email: "demo@codstash.io"` and
  cascades their items, collections, tags, accounts and sessions. Nothing else
  in the database is touched. The seed is destructive for the demo user's rows.
- **Flags the spec is silent on.** It never mentions `isPinned`, `isFavorite`
  or tags. The dashboard renders a pinned-items section and a favorite-
  collections section that would both be empty with every flag false, which
  defeats the point of demo data — so a few are set (assumption, not spec).
  Tags are left out entirely: the spec does not ask for them.
- Setting `migrations.seed` means `prisma migrate reset` and `migrate dev`
  auto-run the seed. Intended, but worth knowing before running a migration.

`npm run build` does not exercise any of this. Verification is `npm run
db:seed`, then `npm run db:test` for the row counts, then a second
`db:seed` + `db:test` to prove idempotency.

---

Previous feature (completed) — Database, Prisma 7 + Neon PostgreSQL.
Spec: `@context/features/database-spec.md`. Its notes follow.

Stand up the data layer the mock has been standing in for.

- Neon PostgreSQL (serverless)
- Initial Prisma schema from the data models in `project-overview.md`, expected
  to evolve
- NextAuth models: `Account`, `Session`, `VerificationToken`
- Appropriate indexes and cascade deletes
- **Prisma 7**, which has breaking changes — see below
- Always `prisma migrate`, never `db push`, unless explicitly told otherwise

## Notes

References:

- `@context/project-overview.md` — the rough Prisma draft (User, Item, ItemType,
  Collection, Tag, ItemTag) and the tech stack
- `@context/coding-standards.md` — `prisma migrate dev` for schema changes,
  `prisma migrate status` before committing, `prisma migrate deploy` in prod
- Prisma 7 upgrade guide:
  https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
- Quickstart: https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/prisma-postgres

Already in place:

- `.env` exists and holds a `DATABASE_URL` pointing at Neon. It is gitignored
  (`.env*`), so it must not be committed. Treat it as the development branch.
- No Prisma dependency is installed yet; nothing in `package.json` touches the
  database.

Prisma 7 breaking changes that shape the setup (verified against the 7.6.0
docs, not from memory):

- **The generator changed.** `provider = "prisma-client"` replaces
  `prisma-client-js`, and it requires an explicit `output` path. For Next.js,
  set `importFileExtension = ""` so generated imports work with the bundler.
- **A driver adapter is now mandatory.** `new PrismaClient()` with no adapter
  no longer connects. For Neon that means `@prisma/adapter-neon` with
  `@neondatabase/serverless`, or `@prisma/adapter-pg` over plain Postgres.
- **The client is imported from the generated output path**, not implicitly
  from `@prisma/client` as before.

Design decisions to make:

- Where the generated client lands, and gitignoring it.
- The client singleton belongs at `src/lib/prisma.ts` per `coding-standards.md`,
  guarded against hot-reload duplication in dev.
- Cascade deletes: deleting a `User` should clear their items, collections,
  tags and auth rows; deleting a `Collection` should probably null out
  `Item.collectionId` rather than delete the items.
- Indexes worth having from the start: `Item.userId`, `Item.typeId`,
  `Item.collectionId`, `Collection.userId`, `Tag.userId`, and a unique
  `(userId, name)` on `Tag` so a user cannot create the same tag twice.

Where the mock and a real schema diverge — relevant when the UI is switched
over, not for this feature:

- `Item.tagIds` is a flat array in the mock; the schema uses the `ItemTag` join
  table from the draft.
- `Collection.itemCount` is denormalized in the mock (306 total). In the
  database it becomes a `_count` aggregate, and the number will drop to the
  real row count.
- `dashboardStats` and `recentCollections` are computed at module load in the
  mock; they become queries.
- Timestamps are anchored to `MOCK_NOW` so relative labels match the design.
  Real rows make `formatRelativeTime` measure against the wall clock instead,
  which is what its `now` parameter exists for.

Decided:

- **Dev branch only for now.** `DATABASE_URL` stays as the development branch;
  the production branch is deferred until deployment needs it.
- **NextAuth is installed** (`next-auth@5.0.0-beta.32` — v5 is still on the
  `beta` tag, there is no stable release) with `@auth/prisma-adapter@2.11.3`.

Auth model shapes, read from `@auth/prisma-adapter` and `@auth/core/adapters`
in `node_modules` rather than written from memory:

- `User` — needs `email` unique and `emailVerified DateTime?`; the adapter
  calls `findUnique({ where: { email } })`. Note the draft in
  `project-overview.md` has `password String?`, which coexists fine.
- `Account` — needs `@@unique([provider, providerAccountId])`, because the
  adapter queries `where: { provider_providerAccountId }`. Fields: `userId`,
  `type`, `provider`, `providerAccountId`, plus the optional OAuth columns
  (`refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`,
  `id_token`, `session_state`).
- `Session` — `sessionToken` unique, `userId`, `expires DateTime`.
- `VerificationToken` — `@@unique([identifier, token])`, plus `expires`. The
  adapter deletes any `id` field it finds, so do not add one.
- `Authenticator` (WebAuthn/passkeys) is also referenced by the adapter but is
  only needed if passkeys are used. Out of scope — the spec asks for the three
  models above.

Open questions:

- Whether `Item.language`, `contentType` and the type/color fields should be
  enums or stay strings. The mock uses string unions.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-08-01 — Created `src/lib/mock-data.ts` on branch `feature/mock-data`.
- 2026-08-01 — Mock user renamed to CodStash / CS to match the logo.
- 2026-08-01 — Mock data merged into `main` (`3cb0917`). Build, typecheck and
  lint green. Feature completed.
- 2026-08-01 — Started Dashboard UI Phase 1 (layout shell). Scope: ShadCN init,
  `/dashboard` route, dashboard layout and global styles, dark mode by default,
  display-only top bar, sidebar and main placeholders.
- 2026-08-01 — ShadCN initialized (style `base-nova`, `@base-ui/react`, lucide);
  added `button` and `input`. `/dashboard` route, top bar and placeholders in
  place. Build, typecheck and lint green.
- 2026-08-01 — Fonts: shadcn scaffolds `@theme inline { --font-sans:
  var(--font-sans) }`, which is self-referential and invalid at computed-value
  time, so `@apply font-sans` resolved to nothing. Fixed by keeping the
  next/font variables named `--font-geist-sans` / `--font-geist-mono` and
  pointing the theme keys at them. `--font-mono` added at the same time.
  Verified in the compiled CSS.
- 2026-08-01 — Browser check could not be run in this environment: Chromium is
  missing `libgbm.so.1` and installing it needs sudo. Verified via the compiled
  CSS instead, then reviewed in a browser by the author.
- 2026-08-01 — Phase 1 merged into `main` (`fe8d169`) and pushed (`22753c6`).
  Feature completed.
- 2026-08-01 — Started Dashboard UI Phase 2 (sidebar). Scope: collapsible
  sidebar, item types linking to `/items/TYPE`, favorite collections, recent
  collections, user avatar area at the bottom, drawer toggle, drawer on mobile.
- 2026-08-01 — All lucide icon names in `mock-data.ts` verified against
  `lucide-react@1.28`; every one resolves, so nothing needed changing.
- 2026-08-01 — Built on shadcn's `sidebar` component (plus `avatar`, `tooltip`,
  `separator`, which pulled in `sheet` and `skeleton`). It supplies collapse,
  the mobile drawer, cookie persistence and a ⌘B shortcut, so no custom state
  was written. `dashboard/layout.tsx` rewritten around
  `SidebarProvider > Sidebar + SidebarInset`, which also removed the redundant
  `min-h-svh` carried over from phase 1. Route segments derive from
  `pluralName.toLowerCase()`; icon and color tokens map through explicit
  `Record`s so Tailwind and tree-shaking both see them.
- 2026-08-01 — The sidebar collapse trigger sits in the top bar rather than the
  sidebar header as in the screenshot: with `collapsible="icon"` a trigger
  inside the header would vanish when collapsed, leaving no way to reopen.
- 2026-08-01 — `npm run lint` failed on shadcn's generated `use-mobile.ts`
  (`react-hooks/set-state-in-effect`). Rewritten with `useSyncExternalStore`.
  May need reapplying if shadcn regenerates the file.
- 2026-08-01 — Phase 2 completed, merged into `main` (`224571a`) and pushed.
- 2026-08-01 — Started Dashboard UI Phase 3 (main area). Scope: main area to the
  right, recent collections, pinned items, 10 recent items, 4 stats cards.
- 2026-08-01 — Lifted the icon / color / href maps out of `AppSidebar` into
  `src/lib/item-type-ui.ts` so the cards and rows share one definition rather
  than duplicating four `Record`s. Mechanical import swap, no behaviour change.
- 2026-08-01 — Added `favoriteItemCount` to `dashboardStats`, with a comment at
  the definition noting it counts the 18-row sample while `totalItems` is the
  denormalized 306. The two are not comparable until real data exists; the
  cards ship with that inconsistency visible (306 items beside 3 favorites).
- 2026-08-01 — `formatRelativeTime` in `src/lib/format.ts` measures against
  `MOCK_NOW`, not the wall clock: `/dashboard` prerenders static, so `new
  Date()` would freeze at build time and drift.
- 2026-08-01 — Stats cards follow the spec rather than the screenshot, as the
  spec directs. Only 2 items are pinned, so that section is sparse.
- 2026-08-01 — A leftover phase 2 dev server held port 3000 and served a stale
  page; an identical byte count gave it away. Checking response content, not
  just the HTTP status, is what catches this.
- 2026-08-01 — Phase 3 completed and merged into `main` (`c8e1552`). The
  three-phase dashboard UI is done. Not yet pushed at that point.
- 2026-08-01 — Started Database (Prisma 7 + Neon PostgreSQL) on branch
  `feature/database`. Dashboard phase 3 pushed by the author beforehand.
- 2026-08-01 — Installed `prisma` / `@prisma/client` 7.9.1,
  `@prisma/adapter-neon`, `@neondatabase/serverless`,
  `next-auth@5.0.0-beta.32` and `@auth/prisma-adapter`. `npm audit` reports 4
  pre-existing vulnerabilities in Next's own transitive deps (postcss, sharp);
  `npm audit fix --force` would downgrade Next to 9.3.3, so they stay.
- 2026-08-01 — `npx tsc --noEmit` can fail on a stale
  `.next/dev/types/validator.ts` left by a previous dev server. Deleting
  `.next` clears it; `npm run build` is unaffected.
- 2026-08-01 — Schema written: the six domain models from the draft plus
  `Account`, `Session` and `VerificationToken`. Cascade rules — deleting a user
  clears everything of theirs; `Item.typeId` is `Restrict` so a type still in
  use cannot be deleted; `Item.collectionId` is `SetNull` so deleting a
  collection leaves its items uncategorised rather than destroying them.
- 2026-08-01 — First `migrate dev` failed with P1001. The cause was a suspended
  Neon compute, not networking: a plain query through
  `@neondatabase/serverless` woke the endpoint and the migration then applied.
  An IPv6/Rust-engine theory led to briefly adding `@prisma/adapter-pg` and
  `experimental.adapter` / `engine: "js"` to the config; those keys do not
  exist in `@prisma/config` 7.9.1 and were being ignored. Both reverted, the
  package uninstalled. The plain config — schema, migrations path,
  `datasource.url` — is all that is needed.
- 2026-08-01 — Migration `20260801221937_init` applied. Verified against the
  database rather than the CLI output: 9 tables plus `_prisma_migrations`, 26
  indexes, and every foreign key carrying its intended ON DELETE rule.
- 2026-08-01 — `src/lib/prisma.ts` holds the singleton, using `PrismaNeon` at
  runtime and guarded against hot-reload duplication. The generated client goes
  to `src/generated/prisma`, gitignored.
- 2026-08-01 — `scripts/test-db.ts` added, run via `npm run db:test`. Checks the
  connection, counts every model, then does a full write round-trip inside a
  transaction that throws on purpose so it rolls back, and asserts nothing
  persisted. Needed `tsx`: plain `node --experimental-strip-types` cannot load
  the generated client, whose imports are extensionless by design
  (`importFileExtension = ""` for the Next bundler).
- 2026-08-01 — `$queryRaw` on `current_database()` / `current_user` fails with
  P2010 `UnsupportedNativeDataType`: they return PostgreSQL's `name` type,
  which the driver adapter cannot deserialize. Cast to `::text`. Worth knowing
  before writing any other raw query.
- 2026-08-01 — Database feature completed and merged into `main` (`c9657df`).
  Build, typecheck, lint and `prisma migrate status` all green; `.env` and the
  generated client confirmed absent from history. Not pushed yet.
- 2026-08-01 — Started Seed Data on branch `feature/seed`. `bcryptjs@3.0.3`
  installed as a runtime dependency (NextAuth credential login will want it
  too); it ships its own types, so no `@types/bcryptjs`.
- 2026-08-01 — `prisma/seed.ts` written, plus `npm run db:seed` and
  `migrations.seed` in `prisma.config.ts`. Seeded 1 user, 7 system types, 5
  collections, 18 items. Verified with `db:test`: users 1, itemTypes 7,
  collections 5, items 18, tags 0, itemTags 0 — identical after a second
  `db:seed`, so the reset-and-recreate path is idempotent. Build, `tsc
  --noEmit` and lint all green.
- 2026-08-01 — The stale comment in `src/lib/prisma.ts` claiming migrations use
  `@prisma/adapter-pg` was left here; removed in the 2026-09-19 cleanup.
- 2026-08-01 — Workflow correction from the author: document the feature, then
  stop and wait for an explicit go-ahead before implementing. Document → Branch
  → Implement are separate checkpoints, not one run.
- 2026-08-01 — Seed feature completed and merged into `main` (`c05b9ee`), branch
  deleted. Not pushed yet.
- 2026-08-01 — A `npm run dev` I had backgrounded during the seed feature
  outlived its command and held port 3000, so the author's own `npm run dev`
  hit "Another next dev server is already running" and the browser showed a
  dead page. Killed. Background dev servers must be stopped before handing
  back.
- 2026-08-02 — Started Root redirect on branch `feature/root-redirect`.
  `src/app/page.tsx` now calls `redirect("/dashboard")` from `next/navigation`;
  the API was read from
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`,
  which confirms a 307 outside Server Actions and that no `return` is needed
  (the function returns `never`).
- 2026-08-02 — Verified against a running server, not just the build: `GET /`
  returns `307 Temporary Redirect` with `location: /dashboard`, and following
  it lands on `/dashboard` with a 200. Build reports `/` as still static; lint
  green.
- 2026-08-02 — Chose `redirect()` in the route over a `redirects()` entry in
  `next.config.ts` or a `middleware.ts`. Beyond being the smallest change, a
  config-level `permanent: true` emits a 308 that browsers cache hard; the
  307 stays reversible if `/` ever becomes a landing page. Scope was
  `src/app/page.tsx` only — the `(dashboard)` route-group refactor still in the
  backlog was deliberately not bundled in.
- 2026-08-02 — Turbopack panicked for the author with `Input image not found`
  (`StructuredImageFileSource` → `get_meta_data`, while formatting an unrelated
  HMR issue). Not the redirect and not a corrupt favicon: `src/app/favicon.ico`
  was valid, but `.next` held WSL absolute paths
  (`/mnt/e/PROGRAMMING/CODE/codstash/src/app/favicon.ico.mjs`) and no `E:\`
  ones. A `.next` written by my WSL `build` / `dev` cannot be read by a
  Windows-side `next dev`. Deleting `.next` clears it. Open question for the
  author: which environment we standardise on, since alternating between them
  re-poisons the cache each time.
- 2026-08-02 — Root redirect feature completed, committed (`aa23c7d`) and merged
  into `main` (`e17df6d`); branch deleted. Not pushed yet.
- 2026-08-03 — Started Dashboard Collections on branch
  `feature/dashboard-collections`. `src/lib/db/collections.ts` holds
  `getDemoUserId()` and `getRecentCollections(userId, limit)`; the queries take
  a `userId` and know nothing about the demo account, so the shim is one
  function to delete when auth lands. Two queries, not N+1: collections with
  `items: { select: { typeId: true } }` and `_count`, plus one `itemType`
  lookup, aggregated in JS.
- 2026-08-03 — `RecentCollections` is now an async server component fetching
  directly, per `coding-standards.md:29`. `item-type-ui.ts` gained
  `washClasses` (6%) and `ringClasses` (40% on hover) spelled out literally,
  plus `toItemTypeSlug` / `toColorToken` guards that narrow the database's plain
  strings and return null for anything unrecognised, so a Pro user's custom type
  cannot crash the card.
- 2026-08-03 — `Card` draws its edge with `ring-1 ring-foreground/10`, not a
  border, so the hover accent overrides the ring rather than a border colour.
- 2026-08-03 — Bug found in review of the rendered HTML, not by the build:
  putting the wash utility in `Card`'s `className` made **tailwind-merge drop
  `bg-card`**, since it treats the two `bg-*` utilities as conflicting. The card
  lost its opaque surface and the tint sat on the page background. Fixed by
  moving the wash onto its own `absolute inset-0` layer inside the card, which
  is what the colour-handler document's §4 stacking diagram describes anyway.
- 2026-08-03 — Verified against the rendered page: 5 cards, every one keeping
  `bg-card` with the wash on a separate layer; accents emerald / amber / cyan /
  yellow; footers `Snippet · 3`, `Prompt · 3`, `Link · 4`, `Command · 4`,
  `Link · 4`; DevOps showing 3 type chips (2 Link, 1 Command, 1 Snippet) and the
  rest 1 each; timestamps rendering "Yesterday" from the wall clock rather than
  MOCK_NOW. `tsc --noEmit` and lint green.
- 2026-08-03 — **File watching does not work on `/mnt/e`.** The dev server
  served stale HTML through twelve requests after an edit and never logged a
  recompile; restarting it picked the change up. Any HMR-based check here has to
  restart the server, or it verifies the previous version of the code.
- 2026-08-03 — **A Prisma query does not make a route dynamic.** The doc here
  first claimed `/dashboard` would flip `○` → `ƒ` as a matter of course; the
  build said otherwise — still `○`, with the rows and `new Date()` baked in at
  build time, which is the exact drift `formatRelativeTime` was written to
  avoid. Next only opts a route out of prerendering when it sees a request-time
  API, and Prisma is invisible to it. Fixed with `await connection()` from
  `next/server` at the top of `RecentCollections`, which
  `01-app/03-api-reference/04-functions/connection.md` prescribes for a
  component needing per-request output without touching cookies or headers; its
  "Synchronous database drivers" example is this case. Rebuilt: `/dashboard` is
  now `ƒ`, `/` still `○`. A dev server check is what proves the component still
  renders, since a dynamic route is not executed during the build.
- 2026-08-03 — The lesson worth keeping: a dev server renders dynamically no
  matter what, so every check made against it passes identically whether the
  production route is static or dynamic. Only the build's route table
  distinguishes them.
- 2026-08-03 — `npm run build` was run twice despite the open environment
  question, because it is the only thing that reveals the above. `.next` was
  deleted afterwards both times, so the author still gets a cold start.
- 2026-08-04 — Started Dashboard Items on branch `feature/dashboard-items`.
  `src/lib/db/items.ts` holds `getPinnedItems` and `getRecentItems` (which also
  returns `totalCount` for the "10 of 18" header) over a shared select that
  pulls the type and the collection name back with each row; `src/lib/db/stats.ts`
  holds `getDashboardStats`, four counts issued together. `ItemRow` now takes a
  `DashboardItem` and a `now`, and no longer looks anything up itself.
  `PinnedItems`, `RecentItems` and `StatsCards` each call `await connection()`
  rather than relying on `RecentCollections` to keep the route dynamic.
- 2026-08-04 — Scope: `PinnedItems`, `RecentItems` and `StatsCards` off the mock
  onto Prisma; layout unchanged. `src/lib/db/items.ts` for pinned and recent
  rows (type and collection name included in the select, no N+1); `src/lib/db/stats.ts`
  for four counts issued together. `ItemRow` re-typed to `DashboardItem`, takes
  `now` for wall-clock relative labels. Each section calls `await connection()`
  on its own — a Prisma query does not opt the route out of prerendering.
- 2026-08-04 — Data layer verified against the database: stats
  `18 / 5 / 3 / 1`; 2 pinned rows (`Code review — correctness first` →
  Prompt/amber/AI Workflows, `useDebounce` → Snippet/emerald/React Patterns);
  recent "10 of 18" in `updatedAt` order with type and collection name on every
  row. `tsc --noEmit` and lint green.
- 2026-08-04 — **The rendered HTML was not checked, and the reason is the open
  environment question.** The author had a dev server running on Windows —
  `.next/dev/lock` held `{"pid":27176,"port":3000}`, a Windows PID — so a WSL
  `next dev` died with `Permission denied (os error 13)` acquiring the lock. It
  was not reachable from WSL on either the host IP or the WSL gateway. An
  isolated copy under /tmp with `node_modules` symlinked also failed: Turbopack
  rejects a symlink "that points out of the filesystem root". Nothing was killed
  or deleted. Checked afterwards rather than assumed: **0 files under
  `.next/dev` contain a `/mnt/e/` path**, so the aborted WSL process did not
  poison the author's cache — it died acquiring the lock, which happens before
  Turbopack writes anything. Verification stopped at the data layer plus `tsc`.
- 2026-08-04 — The author stopped their dev server, so both checks were then
  run for real. Build: `/dashboard` is `ƒ`, `/` still `○`. Rendered page: stats
  cards `Items 18 / Collections 5 / Favorite items 3 / Favorite collections 1`;
  pinned section showing `Code review — correctness first` (Prompt, amber, AI
  Workflows) and `useDebounce` (Snippet, emerald, React Patterns), with the old
  "Nothing pinned yet." placeholder gone from the markup; recent header "10 of
  18" over the ten most recent titles, all labelled "2d ago" from the wall
  clock. The empty-pinned `return null` branch stays unexercised — two rows are
  pinned.
- 2026-08-04 — Mock strings do still appear in the served HTML
  (`System Prompts`, `Architecture Notes`, `Design Assets`), all inside
  `sidebar-menu` markup and its copy in the RSC flight payload — the sidebar is
  out of scope. A grep for "306" hits only a flight-payload chunk id
  (`305:D"$306"`), not the mock's item total. Nothing mock-derived renders in
  the main area.
- 2026-08-04 — Surviving `mock-data` importers after this feature, checked:
  `AppSidebar` (collections, currentUser, itemTypes, recentCollections),
  `item-type-ui.ts` (the type unions plus `itemTypes` for `typeById`), and
  `format.ts` (`MOCK_NOW`). Nothing dangling.
- 2026-08-04 — Empty-pinned behaviour changed deliberately: `PinnedItems` returns
  `null` when nothing is pinned, replacing the dashed "Nothing pinned yet."
  placeholder — heading included, per spec.
- 2026-08-04 — `StatsCards` confirmed in scope by the author — the last mock
  consumer in the main area. Counts drop from the mock's denormalized 306 items
  to **18 / 5 / 3 / 1** against the seed, which is intended; the old note that
  `totalItems` and `favoriteItemCount` were not comparable goes with the mock.
- 2026-08-04 — "Item type tags" read as the existing type label on each row, not
  the `ItemTag` join table — the seed created no tags. The sidebar keeps reading
  the mock; it is the only mock consumer left in the UI once this lands.
- 2026-08-14 — Dashboard Items feature completed and merged into `main`
  (`0d1c34c`); branch `feature/dashboard-items` deleted. Not pushed yet.
- 2026-08-14 — Started Stats & Sidebar on branch `feature/stats-sidebar`.
  Extended `src/lib/db/collections.ts` with `aggregateCollectionTypes` (shared
  with `getRecentCollections`), `getItemTypes`, `getFavoriteCollections`,
  `getSidebarRecentCollections` (limit 5), and `getDemoUser`. Moved
  `ItemTypeSlug` / `ColorToken` to `src/types/item-type.ts`; `item-type-ui.ts`
  gained `typePluralNames`, `sidebarTypes`, slug-based `itemTypeHref`, and
  `initialsFromName`, and dropped the mock-backed `typeById`.
- 2026-08-14 — `AppSidebar` is now an async server component with
  `await connection()`. Types link to `/items/snippets`, etc., in fixed sidebar
  order (Snippets, Prompts, Notes, Files, Images, Links — Commands omitted from
  the list per author). Favourites use type-coloured icons; recents wrap each
  icon in a round `surfaceClasses` circle keyed to the dominant type — corrected
  from an initial row-wide background after the spec was updated. **View all
  collections** links to `/collections` below Recent. Footer reads the seeded
  demo user from the database.
- 2026-08-14 — Main-area stats left untouched (`StatsCards` already on Prisma).
  `/items/*` and `/collections` hrefs wired; pages still 404. Build and lint
  green. Only `format.ts` still imports `MOCK_NOW` from `mock-data.ts`.
- 2026-08-14 — Stats & Sidebar feature completed and merged into `main`; branch
  `feature/stats-sidebar` deleted.
- 2026-09-11 — Started Add Pro Badge to Sidebar on branch
  `feature/add-pro-badge-sidebar`. Added the shadcn/ui `badge` component
  (`src/components/ui/badge.tsx`), declared `proTypeSlugs` (`file`, `image`) in
  `src/lib/item-type-ui.ts`, and rendered a subtle uppercase `PRO` badge
  (`variant="secondary"`, `text-muted-foreground`, `ml-auto`) next to the Files
  and Images rows in `AppSidebar`. The badge hides when the sidebar collapses to
  icons via `group-data-[collapsible=icon]:hidden`.
- 2026-09-11 — Both Files and Images are badged deliberately, per the spec, even
  though `project-overview.md` gates only file uploads behind Pro (free tier
  allows image uploads). Build, `tsc --noEmit` and lint all green; `/dashboard`
  stays `ƒ`.
- 2026-09-11 — Add Pro Badge to Sidebar feature completed and merged into `main`
  (`4e51607`, fast-forward); branch `feature/add-pro-badge-sidebar` deleted. The
  branch was never pushed, so there is no origin branch to remove.
- 2026-09-19 — Cleanup: reordered this History, removed the stale
  `@prisma/adapter-pg` comment from `src/lib/prisma.ts`, added the `cleanup` and
  `feature` skills and the `code-scanner` subagent, and gitignored
  `.claude/settings.local.json`. `code-scanner` found no critical or high
  issues; its medium and low findings seeded the next feature.
- 2026-09-19 — Started Scanner Quick Wins on branch
  `feature/scanner-quick-wins`. In `src/lib/db/collections.ts`,
  `getDemoUserId`, `getDemoUser` and `getItemTypes` are wrapped in React
  `cache()` (per-request memoisation; the Next docs' "Deduplicating requests"
  pattern for ORM calls), and `loadTypeLookup` now calls `getItemTypes` instead
  of repeating its query.
- 2026-09-19 — The per-item row fetch is gone: `getCollectionsWithTypes` and
  `getRecentCollections` no longer `include` every item's `typeId`. A new
  `loadTypeCounts` issues one `item.groupBy` on `collectionId` + `typeId` after
  the collections are fetched (skipped when there are none), and
  `aggregateCollectionTypes` now takes `{ typeId, count }` pairs with the same
  ordering — most-used first, ties on slug.
- 2026-09-19 — `formatRelativeTime` now requires `now`; the `MOCK_NOW` import
  and the stale "statically prerendered" comment are gone from `format.ts`, so
  `mock-data.ts` has no importers left (deleting it is a separate decision).
- 2026-09-19 — Verified against the database with a throwaway script:
  `getRecentCollections` and the sidebar queries return Design Resources
  `link:4`, Terminal Commands `command:4`, DevOps `link:2,command:1,snippet:1`,
  AI Workflows `prompt:3`, React Patterns `snippet:3` — identical to the counts
  recorded on 2026-08-03 — and the favourite is React Patterns `snippet:3`.
  `tsc --noEmit`, lint and `npm run build` are green; `/dashboard` is still `ƒ`.
  The rendered HTML was not checked in a dev server. `.next` was left in place
  after the build, so delete it before a Windows-side `next dev`.
- 2026-09-19 — Scanner Quick Wins completed and merged into `main`
  (`e69cced`, fast-forward); branch `feature/scanner-quick-wins` deleted. The
  branch was never pushed. Left out on purpose from the same scan: `<Suspense>`
  boundaries around dashboard sections (changes streaming), splitting
  `AppSidebar` / `RecentCollections` plus a `getPrimaryType` helper (multi-file
  refactor), and the inert sidebar collection buttons (already in the backlog).
  Not exercised: the empty-collection path and a rendered-page check in a dev
  server.
- 2026-09-20 — Started Loading, Errors, Limits & Indexes on branch
  `feature/loading-errors-limits-indexes`. Both open decisions taken at their
  recommended defaults: an `error.tsx` at the app level as well as under
  `dashboard/`, and ceilings of 50 (collections) and 100 (items) — the ceilings
  remain a guess, sized well above today's 5 collections and 18 items.
- 2026-09-20 — Limits: `src/lib/db/limits.ts` holds `clampLimit(limit, max)` —
  a non-integer or a value below 1 throws `RangeError`, a value above the max is
  clamped. Applied to `getRecentCollections`, `getSidebarRecentCollections` (via
  `getCollectionsWithTypes`, whose `limit` now defaults to the ceiling, so
  `getFavoriteCollections` is bounded too) and `getRecentItems`;
  `getPinnedItems` takes the item ceiling. Exercised against the database:
  `9999 → 50`, `51 → 50`, `0`, `-5`, `2.5`, `NaN` and `Infinity` all throw, and
  `getRecentItems(uid, 9999)` returns all 18 rows; dashboard results unchanged
  (10 recent items, 2 pinned, 5 collections, 1 favourite).
- 2026-09-20 — Loading: `DashboardSkeletons.tsx` holds `DashboardSkeleton`
  (stats cards, collections grid, two item columns, mirroring the real
  footprint) shown by `src/app/dashboard/loading.tsx`, and `SidebarSkeleton`,
  which renders the same `Sidebar` shell so `SidebarInset` keeps its offset.
  `dashboard/layout.tsx` wraps `AppSidebar` in `<Suspense>`, because
  `loading.tsx` does not cover its own segment's layout.
- 2026-09-20 — Errors: `ErrorFallback` (client) shows fixed copy, the
  `error.digest` reference and a **Try again** button, and never `error.message`.
  `dashboard/error.tsx` keeps the shell and swaps the page; `src/app/error.tsx`
  also catches a failing `AppSidebar`. Both use `unstable_retry`, which
  re-fetches — `reset` would only clear the state and re-throw.
- 2026-09-20 — Indexes: migration `20260920003036_add_query_indexes` created
  with `prisma migrate dev` — `Collection(userId, isFavorite)` and
  `Item(collectionId, typeId)`, and nothing else in the SQL. Verified against the
  database: both indexes exist in `pg_indexes`, `_prisma_migrations` lists it
  after `init`, `migrate status` reports the schema up to date, and row counts
  are unchanged (users 1, itemTypes 7, collections 5, items 18), so the seed did
  not rewrite anything. The redundant `[userId]` prefix indexes were left alone.
- 2026-09-20 — **Loading state removed, to be revisited.** The author saw the
  skeleton sit there for 3–4 s and asked for it to come out. Deleted
  `src/app/dashboard/loading.tsx` and `DashboardSkeletons.tsx`, and put
  `dashboard/layout.tsx` back to its committed state (no `<Suspense>` around
  `AppSidebar`; `git diff` on it is empty). The error boundaries, the limit
  validation and the indexes stay. `tsc --noEmit` and lint green after the
  removal.
- 2026-09-20 — What was learned while debugging it, for the return visit: with
  the boundary in place the page really streams, and on the author's Windows
  machine (Node v24.12.0) the dev log showed `TypeError:
  controller[kState].transformAlgorithm is not a function`, a Node
  `TransformStream` cancel race fixed upstream (nodejs/node#62040) — updating
  Node was the remedy the author took. A page that reloaded in a loop was
  cleared by deleting `.next`; a WSL `next build` / `next start` run while a
  Windows `next dev` holds the project is the likely cause. Server time was
  ~0.7–1.2 s in the author's log against 3–4 s perceived, which is unexplained:
  Neon waking, the round trip to `us-east-2`, and dev-mode overhead are the
  suspects, and a production build (`npm run build && npm start`) plus the
  Network tab's time-to-first-byte would separate them. Per-section
  `<Suspense>` and fewer sequential queries were proposed, not built.
- 2026-09-20 — `tsc --noEmit`, lint and `npm run build` are green; `/dashboard`
  is still `ƒ`. **Not checked in a browser:** the skeleton and the error
  fallback (retry recovering after a forced failure). `.next` was left in place
  after the build — delete it before a Windows-side `next dev`.
- 2026-09-20 — Errors, Limits & Indexes completed and merged into `main`
  (`fa2f7ac`, fast-forward); branch `feature/loading-errors-limits-indexes`
  deleted. The branch was never pushed. Shipped: `dashboard/error.tsx` and
  `src/app/error.tsx` over a shared `ErrorFallback`, `clampLimit` in
  `src/lib/db/limits.ts` (ceilings 50 collections / 100 items — a guess), and
  migration `20260920003036_add_query_indexes`. **Deferred, to revisit:** the
  loading-state skeleton (see the removal entry above). **Not exercised:** the
  error fallback was never forced to fail in a browser, so "Try again"
  recovering is untested. A stale empty `.git/index.lock` (00:24) blocked git
  and was deleted at the author's request. `npm run build` was green with
  `/dashboard` still `ƒ`.
- 2026-09-21 — Started Auth Setup (NextAuth + GitHub) on branch
  `feature/auth-github`. Conventions checked against Context7 (Auth.js docs) and
  `03-file-conventions/proxy.md` before writing code: the split config, JWT plus
  adapter, the `jwt` / `session` callbacks for `user.id`, and a `proxy` that is
  either a default or a named export. The demo-user shim was left untouched, as
  recommended — `getDemoUserId()` still feeds every dashboard query, so a signed-in
  GitHub user will see the demo account's data until a later phase.
- 2026-09-21 — Files: `src/auth.config.ts` (GitHub provider only),
  `src/auth.ts` (`PrismaAdapter(prisma)`, `session: { strategy: "jwt" }`, and
  callbacks copying `user.id` into the token then the session),
  `src/app/api/auth/[...nextauth]/route.ts`, `src/proxy.ts` (named export
  `proxy = auth(...)` built from the adapter-free config; redirects an anonymous
  request to `/api/auth/signin?callbackUrl=…`; matcher `/dashboard/:path*`, so
  `/api/auth/*` is never intercepted) and `src/types/next-auth.d.ts`. No packages
  were installed and no env keys were added — both already existed.
- 2026-09-21 — **The `JWT` augmentation has to target `@auth/core/jwt`**, not
  `next-auth/jwt` as the Auth.js docs snippet suggests: `next-auth/jwt` is only
  `export * from "@auth/core/jwt"`, so augmenting the re-export did not merge
  into the interface and `token.id` stayed `unknown` (TS2322). Augmenting the
  declaring module fixed it, and `PrismaAdapter(prisma)` accepted the generated
  Prisma 7 client without a cast.
- 2026-09-21 — Verified on a production build: `npm run build` lists
  `ƒ /api/auth/[...nextauth]` and `ƒ Proxy (Middleware)`, `/dashboard` stays `ƒ`,
  `tsc --noEmit` and lint green. Against `next start` on :3100: an anonymous
  `/dashboard` and `/dashboard/x` get a 307 to the sign-in URL with the right
  `callbackUrl`, `/` ends up at sign-in, `/api/auth/providers` lists only GitHub,
  the sign-in page renders "Sign in with GitHub", and `/api/auth/session` is
  `null`, with no auth errors in the server log.
- 2026-09-21 — **`next start` needs `AUTH_TRUST_HOST=true` off Vercel.** Without it
  every `/api/auth/*` call returned a 500 `UntrustedHost`, while the proxy redirect
  still worked. `next dev` does not need it. It was set in the test shell only,
  not in any file; a non-Vercel deployment will have to set it.
- 2026-09-21 — **Not verified:** the real GitHub round trip (sign in, come back on
  `/dashboard`, a `User` and `Account` row created) needs a browser and the
  author's GitHub account, with the OAuth App callback set to
  `http://localhost:3000/api/auth/callback/github`. `.next` was left in place
  after the build — delete it before a Windows-side `next dev`.
- 2026-09-21 — Auth Setup (NextAuth + GitHub) completed and merged into `main`
  (`21da98e`, fast-forward); branch `feature/auth-github` deleted. The branch was
  never pushed. Shipped: `src/auth.config.ts`, `src/auth.ts`,
  `src/app/api/auth/[...nextauth]/route.ts`, `src/proxy.ts` and
  `src/types/next-auth.d.ts`. **Not verified by me:** the real GitHub round trip
  (sign in, land back on `/dashboard`, `User` and `Account` rows created) — it
  needs the author's browser and GitHub account, and no result was reported
  before completing. **Still true after this feature:** the demo-user shim feeds
  every dashboard query and the sidebar footer, so a signed-in GitHub user sees the
  demo account's data; phases 2 and 3 are not started; a non-Vercel deployment must
  set `AUTH_TRUST_HOST=true`. `npm run build` green with `/dashboard` still `ƒ`.
- 2026-09-21 — Started Auth Credentials (phase 2) on branch
  `feature/auth-credentials`. `src/auth.config.ts` gained a Credentials
  placeholder (`authorize: () => null`) beside GitHub; `src/auth.ts` filters that
  placeholder out of the config's providers and adds the real one (lowercased
  email lookup, `bcrypt.compare`, `null` for an unknown user or one with no
  password). `src/app/api/auth/register/route.ts` validates, rejects an existing
  email with 409, hashes at 12 rounds and returns 201. `User.password` already
  existed, so there was no migration.
- 2026-09-21 — Beyond the spec, disclosed: emails are lowercased and checked
  against a simple pattern, and passwords need at least 8 characters.
- 2026-09-21 — Verified on a production build against `next start` on :3100:
  mismatch, short password and bad JSON return 400, a valid registration 201, a
  duplicate 409; credentials sign-in returned 302 to `/dashboard`,
  `/api/auth/session` carried the user id, `/dashboard` returned 200, and a wrong
  password redirected to `?error=CredentialsSignin`; `/api/auth/providers` lists
  `github` and `credentials`. The test user was deleted afterwards. `tsc
  --noEmit`, lint and `npm run build` green; `/dashboard` still `ƒ`.
- 2026-09-21 — Auth Credentials completed and merged into `main` (`34332a4`,
  fast-forward); branch `feature/auth-credentials` deleted. **Not verified:** the
  signin form, the seeded demo login (`demo@codstash.io`) and the GitHub round
  trip in a browser. **Left for a hardening pass, from the review:** a
  registration race (a concurrent duplicate returns 500, not 409, until `P2002`
  is caught), no maximum password length (bcrypt uses the first 72 bytes), no
  rate limiting, a timing difference between unknown and known emails in
  `authorize`, and no email verification. **Still true:** the demo-user shim
  feeds every dashboard query, so any signed-in user sees the demo account's data.

Left undone by the database feature:

- ~~**NextAuth is installed but not configured.**~~ — configured for GitHub in the
  auth phase 1 feature (see the History). Still open: the Credentials provider and
  registration (phase 2), the sign-in / register UI (phase 3), and replacing the
  demo-user shim with the session user.
- **`src/lib/mock-data.ts` has no importers left** since the scanner quick-wins
  feature broke the `format.ts` coupling. Deleting it is still a separate
  decision.
- `Item.contentType`, `language` and the type/color fields are strings rather
  than enums, matching the mock's string unions.

Backlog from the dashboard series:

- The six `/items/TYPE` links (Commands is omitted from the sidebar) and
  `/collections` return 404 — the specs asked for links, not pages. Fix is a `src/app/(dashboard)/` route group so `/items/*` inherits
  the shell without changing URLs. It touches phase 1 files, so it needs a
  decision.
- Sidebar collection rows still render as buttons, not links; `/collections` is
  linked only via **View all collections**.
- ~~`/` still renders the placeholder `<h1>Codstash</h1>`~~ — answered: it
  redirects to `/dashboard`. See the current feature above.

Environment notes that outlive any one feature:

- npm is run from WSL on this side. `node_modules/.bin` holds Unix symlinks, and
  `npm run dev` from Windows once failed with "'next' n'est pas reconnu" —
  though the author has since started it from Windows successfully.
- **Do not mix the two.** `.next` embeds absolute paths in whichever form the
  process that wrote it uses, so a WSL-built cache makes a Windows `next dev`
  panic (and presumably the reverse). Delete `.next` when crossing over.
- Chromium cannot launch here (`libgbm.so.1` missing, sudo required), so
  browser verification is the author's step.
- Pushing to GitHub is the author's step; WSL has no stored GitHub credentials.

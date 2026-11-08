# Current Feature

## Status

Not Started

## Goals

<!-- Bullet points of what success looks like -->

## Notes

<!-- Additional context, constraints, or details from spec -->

---

Previous feature (completed) — Item Create: the top bar's "New Item" button opens a dialog that
creates an item of a chosen type through the `createItem` server action. Spec:
`@context/features/item-create-spec.md`. Outcome in the History below.

---

Previous feature (completed) — Item Delete: the drawer's trash button deletes the item after a
confirmation dialog, with a toast on success. Outcome in the History below.

---

Previous feature (completed) — Item Drawer Edit Mode: the pencil button turns the drawer into an
edit form, saved through the `updateItem` server action. Spec:
`@context/features/item-drawer-edit-spec.md`. Outcome in the History below.

---

Previous feature (completed) — Item Drawer: clicking an item opens a right-side drawer with its
full detail instead of navigating. Spec: `@context/features/item-drawer-spec.md`. Outcome in the
History below.

---

Previous feature (completed) — Instant Navigation Feedback: sidebar clicks show a skeleton
right away, and the sidebar's data no longer holds back the page. Outcome in the History below.

---

Previous feature (completed) — Token Flow and Account Isolation Tests: 59 more unit tests
and a browser check with a second account. Outcome in the History below.

---

Previous feature (completed) — Account Deletion, Commands Sidebar and Slug Fixes:
deleting an account now requires its password, Commands is in the sidebar, and the type
helpers reject inherited keys. Outcome in the History below.

---

Previous feature (completed) — Vitest Unit Testing: `npm test` covers server actions
and utilities, not components, and the workflow now requires it before a commit.
Outcome in the History below.

---

Previous feature (completed) — Item Type Color Fixes: Link moved from `yellow` to
`lime`, and `/items/[type]` cards traded the left border for the dashboard's tint
and hover ring. Outcome in the History below.

---

Previous feature (completed) — Items List View: `/items/[type]` lists the signed-in
user's items of one type in a grid of `ItemCard`s with a colored left border. Spec:
`@context/features/item-list-view-spec.md`. Outcome in the History below.

---

Previous feature (completed) — Rate Limiting for Auth: Upstash sliding-window
limits on sign-in and the four auth API routes, 429 + `Retry-After`, toasts on
the forms, fail-open. Spec: `@context/features/rate-limiting-spec.md`. Outcome
in the History below.

---

Previous feature (completed) — Auth Audit Fixes: sessions end after a password
change or reset, register answers the same for new and existing emails, and
sign-in timing no longer reveals registered emails. Findings from
`docs/audit-results/AUTH_SECURITY_REVIEW.md`. Outcome in the History below.

---

Previous feature (completed) — Profile Page: `/profile` with user info, usage
stats, a change-password modal and account deletion, inside a new `(app)` route
group. Spec: `@context/features/profile-spec.md`. Outcome in the History below.

---

Previous feature (completed) — Forgot Password: an emailed, single-use reset
link, with tokens in `VerificationToken` under `reset@<email>`. Outcome in the
History below.

---

Previous feature (completed) — Email Verification Toggle: the
`EMAIL_VERIFICATION_ENABLED` server env flag switches email verification off
while Resend has no domain linked. Outcome in the History below.

---

Previous feature (completed) — Auth Email Verification, phase 4: Resend emails a
single-use link, credentials sign-in is refused until it is used, a resend path
and a React Email template. Spec: `@context/features/auth-phase-4-spec.md`.
Outcome in the History below.

---

Previous feature (completed) — Auth UI, phase 3: custom `/sign-in` and `/register`
pages, the session user in the sidebar footer with a sign-out menu, and a
registration toast. Spec: `@context/features/auth-phase-3-spec.md`. Outcome in the
History below.

---

Previous feature (completed) — Auth Credentials, phase 2: Credentials provider
and `POST /api/auth/register`. Spec: `@context/features/auth-phase-2-spec.md`;
Outcome in the History below.

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
  `github` and `credentials`. The test user was deleted afterwards — **corrected
  2026-09-21: that was wrong.** `next start` loads `.env.production`, which points at
  a different Neon endpoint than `.env`, so the test user was registered there while
  the cleanup ran against the `.env` database and deleted nothing. `tsc
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
- 2026-09-21 — Started Auth UI (phase 3) on branch `feature/auth-ui`. Pages:
  `/sign-in` and `/register` are async server components calling `await
  connection()` (the build lists both `ƒ`, per the author's rule that pages are
  server rendered and dynamic), with `SignInForm` / `RegisterForm` as client
  leaves in `src/components/auth/`. Sign-in uses server actions in
  `src/actions/auth.ts` (`signInWithCredentials`, `signInWithGitHub`,
  `signOutAction`); a `callbackUrl` is accepted only if it is a same-origin path.
  `pages.signIn` is set in `auth.config.ts` and the proxy redirects to `/sign-in`.
  Register posts to `/api/auth/register` and redirects to `/sign-in`.
- 2026-09-21 — Sidebar footer: `AppSidebar` reads `auth()` instead of
  `getDemoUser()`. `UserAvatar` shows the GitHub image or initials; `UserMenu`
  puts the avatar on a link to `/profile` and the name on a dropdown holding
  **Sign out**. Collections and items still come from `getDemoUserId()`, so any
  signed-in user sees the demo account's data (`getDemoUser` now has no callers).
- 2026-09-21 — Registration toast, added mid-feature and written into the spec by
  the author: sonner via shadcn, `<Toaster />` in the root layout so it survives
  the redirect, green and top-centre, replacing the inline "account created"
  notice and the `?registered=1` parameter. shadcn's `dropdown-menu` and `sonner`
  registry files were not usable as generated: the first imported `cn` from an
  unrelated npm package named `cn` (the CLI installed it) and the second used
  `next-themes` with no provider in a dark-only app. Both were fixed by hand and
  the extra packages removed.
- 2026-09-21 — **Two real bugs, one only visible in a browser.** (1) `next start`
  loads `.env.production`, a different Neon endpoint from `.env`; test users from
  phase 2 and this feature landed there and cleanup ran against `.env`, deleting
  nothing. (2) After a wrong password React 19 resets the form and cleared the
  email, so the `required` field silently blocked the retry; the action now
  returns the email for `defaultValue`.
- 2026-09-21 — **Browser verification now works**, contradicting the earlier
  "cannot launch here" note: `libgbm` is installed, and a plain Playwright script
  drives the cached Chromium. The Playwright MCP still fails (it wants Chrome at
  `/opt/google/chrome/chrome`). Verified against a production build on the `.env`
  database: register shows the green top-centre toast and lands on `/sign-in`; a
  wrong password shows the error and keeps the email; a correct one reaches
  `/dashboard`; the footer shows `TT`, the name, the email and the `/profile`
  link; the menu opens and Sign out returns to `/sign-in`, after which `/dashboard`
  redirects again. The seeded demo login (`demo@codstash.io`, `12345678`) also
  works. `tsc --noEmit`, lint and `npm run build` green with the author's own
  `next.config.ts` once `babel-plugin-react-compiler` was added to
  `devDependencies`.
- 2026-09-21 — Auth UI completed and merged into `main` (`c3dc3d7`, fast-forward);
  branch `feature/auth-ui` deleted. **Not verified:** the GitHub OAuth round trip
  (needs the author's account); the dropdown when the sidebar is collapsed to
  icons, where only the avatar (a profile link) is shown and Sign out is out of
  reach until it is expanded. **Still open:** `/profile` returns 404; the phase 2
  hardening list (rate limiting, the `P2002` race, a password length cap, the
  timing difference in `authorize`, email verification); and `phase2@test.dev`,
  `uitest@test.dev` and `numtest@test.dev` remain in the `.env.production`
  database, untouched because production is off limits without being named.
  `next.config.ts` still carries the author's uncommitted edits.
- 2026-09-21 — Started Auth Email Verification (phase 4) on branch
  `feature/auth-email-verification`. New credentials accounts start with
  `emailVerified` unset and are emailed a link. Token in the existing
  `VerificationToken` table (no migration): 32 random bytes in the link, only the
  SHA-256 hash stored, 24 h expiry, consumed by a `deleteMany` so two concurrent
  requests cannot both use it. `src/lib/verification.ts` issues and consumes it,
  `src/lib/email.tsx` sends it. The resend throttle (one email per address per
  minute) derives the issue time from `expires - TTL`, so no `createdAt` column.
- 2026-09-21 — Behaviour: `POST /api/auth/register` still creates the user when the
  send fails and returns `emailSent: false`; registering with the email of an
  unverified account is a 409 with code `EMAIL_NOT_VERIFIED` (the old account is
  never replaced), a verified or GitHub-only one gets the plain 409. `POST
  /api/auth/resend-verification` answers identically for any address and does its
  lookup and send in `after()`, so neither the body nor the timing reveals whether
  the account exists. `authorize` throws `EmailNotVerifiedError` (a
  `CredentialsSignin` with `code = "email_not_verified"`) only after the password
  is right; Auth.js re-throws the original error in the server action, so
  `signInWithCredentials` reads `error.code`. `/verify-email` is a dynamic server
  page. Resend buttons sit on the verify page, the register form and the sign-in
  form, plus a "Send it again" link on `/sign-in` that needs no session.
- 2026-09-21 — **A first version told a fresh user to "sign in to request a new
  one" when the send failed** — nonsense, since they could not sign in. The cause
  was `APP_URL` missing from `.env`; the fix keeps the user on `/register` with the
  message and a resend button, and the two env values (`EMAIL_FROM`, `APP_URL`) were
  appended to `.env`. `.env.example` is gitignored by `.env*`, so it was updated on
  disk but never committed.
- 2026-09-21 — Email template: React Email via the single `react-email` package
  (version 6 folded components and `render` into it; `@react-email/components` is the
  old way). `src/emails/VerificationEmail.tsx`, inline styles, light background, and
  it is rendered with `render()` for both HTML and plain text before `emails.send`
  rather than through Resend's `react` option. Auth.js has no usable template: the
  Resend provider's `html()` is internal and is a bare magic-link card.
- 2026-09-21 — Verified against a production build on the `.env` database, in a
  browser: unverified sign-in with the right password shows "Verify your email first"
  plus the button, a wrong one shows the ordinary message with no button; registering
  again with the unverified email gives the 409 message with the button and a toast;
  a valid link verifies and the account then signs in, the same link again and an
  expired one show "Link invalid or expired"; the sign-in resend link created a token
  only for the existing unverified account, none for an unknown or verified address,
  and all three answers were identical; the throttle kept the first token and a
  resend after the window replaced it; with an unverified sender domain the user is
  created, `emailSent` is false, the token is deleted and the warning path shows.
  Resend accepted real sends from `onboarding@resend.dev` to `delivered+…@resend.dev`
  test addresses; an unverified domain is reported as `validation_error`, not the 403
  the docs describe. `tsc --noEmit`, lint and `npm run build` green.
- 2026-09-21 — Existing accounts on the dev branch were marked verified with
  `scripts/backfill-email-verified.ts` (dry run, then `--apply`; host checked as
  `ep-little-snow…`): 4 accounts, and a second dry run found 0. A script rather than
  a migration, because `migrate deploy` would apply a migration to production.
  **Production was not touched.**
- 2026-09-21 — Also added, on request: `scripts/delete-all-users-except-demo.ts`
  (dry run by default, refuses the host in `.env.production`, aborts if the demo user
  is missing, deletes items first because of the `Restrict` on `Item.typeId`). Only
  its dry run was executed.
- 2026-09-21 — Auth Email Verification completed and merged into `main` (`2b30ed6`
  and `92032d5`, fast-forward); branch `feature/auth-email-verification` deleted.
  **Not verified:** a real inbox — only Resend's test addresses were used, so no link
  from a delivered mail was clicked, Gmail/Outlook rendering of the template is
  unchecked, and whether `onboarding@resend.dev` can write to arbitrary addresses is
  unconfirmed; the GitHub OAuth round trip. **Still open:** rate limiting beyond the
  resend throttle, the `P2002` race, a password length cap, the timing difference
  between unknown and known emails in `authorize`; production accounts are not
  backfilled and production still holds `phase2@test.dev`, `uitest@test.dev`,
  `numtest@test.dev`; `/profile` returns 404; `.env.example` is untracked.
  `next.config.ts` still carries the author's uncommitted edits.
- 2026-10-04 — Started Email Verification Toggle on branch
  `feature/email-verification-toggle`, with the recommended defaults: the check is
  skipped rather than `emailVerified` stamped, and verification stays on unless the
  value is exactly `"false"`. `src/lib/email-verification-flag.ts` holds
  `isEmailVerificationEnabled()`. It is honoured in `authorize`, in the register
  route (no send and no `EMAIL_NOT_VERIFIED` 409 when off, plus a new
  `verificationRequired` field in the 201), in the resend route (answers
  `{ success: true }` and does nothing), on `/sign-in` (a prop hides "Send it
  again") and in `RegisterForm` ("You can sign in now."). `.env` has
  `EMAIL_VERIFICATION_ENABLED=false`; `.env.example` documents it on disk.
  `.env.production` was not touched, so production keeps verifying.
- 2026-10-04 — Verified in a browser against `next dev` on the `.env` database
  (`ep-little-snow`), not `next start`, which would have loaded `.env.production`.
  **Off:** no resend link on `/sign-in`; registering toasts "You can sign in now."
  and the account reaches `/dashboard`; a duplicate gets the plain 409; resend
  answers `{ success: true }`; the row has `emailVerified` null and no token was
  created. **On** (`EMAIL_VERIFICATION_ENABLED=true` in the server's environment):
  the resend link is back, the toast says "Check your email", sign-in is refused
  with "Verify your email first", a duplicate gets `EMAIL_NOT_VERIFIED`, and the
  account created while the flag was off is now refused too. Both test users and
  their token were deleted afterwards (re-query: 0). `tsc --noEmit`, lint and
  `npm run build` green; `.next` deleted.
- 2026-10-04 — Review gap fixed: `/verify-email` offered a resend button on an
  invalid link even with the flag off, and that button would report success while
  sending nothing. It now shows "Go to sign in" when the flag is off. Checked on
  `next dev` with a bogus token: the page renders "Link invalid or expired" plus
  "Go to sign in", and no "Send a new verification email". `tsc --noEmit` and lint
  green.
- 2026-10-04 — Email Verification Toggle completed and merged into `main`
  (`fab863d`, fast-forward); branch `feature/email-verification-toggle` deleted.
  `npm run build` and lint green after the `/verify-email` fix. `.env` has the flag
  off; `.env.production` was not touched, so a production deploy keeps verifying.
  **Still open:** linking a domain to Resend (then the flag can go back on), and
  the phase 4 hardening list. `next.config.ts` still carries the author's
  uncommitted edits.
- 2026-10-04 — Started Forgot Password on branch `feature/forgot-password`, with
  the recommended defaults. Reset tokens go in `VerificationToken` under
  `identifier = "reset@" + email`. `src/lib/password-reset.ts` holds
  `issuePasswordResetEmail` (1 h TTL, one email per address per minute),
  `isPasswordResetTokenValid` (read-only, for the page) and `resetPassword`
  (consumes the token with `deleteMany`, then sets the hash and, for an
  unverified account, `emailVerified`, and drops its verification tokens).
  `hashToken` is exported from `verification.ts` rather than copied.
  `src/lib/email.tsx` now sends both emails through one private `sendEmail`, and
  the template styles moved to `src/emails/styles.ts`, shared by
  `VerificationEmail` and the new `PasswordResetEmail`. Routes:
  `POST /api/auth/forgot-password` (same answer for any address, lookup and
  send in `after()`) and `POST /api/auth/reset-password` (400 with code
  `INVALID_TOKEN` on a bad link). Pages: `/forgot-password` and
  `/reset-password`, both dynamic, with `ForgotPasswordForm` /
  `ResetPasswordForm` client leaves. `SignInForm` has a "Forgot password?" link
  beside the password label.
- 2026-10-04 — Verified in a browser (Playwright script) against `next dev` on
  the `.env` database (`ep-little-snow`), with a user registered as
  `delivered+fpreset@resend.dev` so Resend accepted the real send. The sign-in
  link opens `/forgot-password`; the request created exactly one
  `reset@…` token, and a second request a moment later kept it (throttle); an
  unknown address got the identical `200 {"success":true}`. A bogus, an expired
  and a verification token on `/reset-password` and a reset token on
  `/verify-email` all show "Link invalid or expired". Opening a valid link twice
  did not consume it; mismatched and short passwords were refused in the form;
  saving showed the "Password updated" toast on `/sign-in`, the hash changed,
  the unverified account became verified and no tokens were left. The same link
  then showed "Link invalid or expired" and the API answered `INVALID_TOKEN`; the
  old password was refused and the new one reached `/dashboard`. A link consumed
  while its page was open showed the error, the "Send a new reset link" link
  and a disabled button. The test user was deleted (re-query: gone).
  `tsc --noEmit`, lint and `npm run build` green; `.next` deleted. After the
  `sendEmail` refactor, both `sendVerificationEmail` and `sendPasswordResetEmail`
  were called directly to `delivered+…@resend.dev` and Resend accepted both
  (`true`/`true`). `IssueResult` is now imported from `verification.ts` rather
  than redeclared. **Not verified:** a real inbox (the email rendered by a mail
  client, and its link clicked).
- 2026-10-04 — The author tested it and received nothing. Cause, read from
  Resend's own answer: a 403 `validation_error`, "You can only send testing emails
  to your own email address (murid.dieng@gmail.com)". The only credentials
  account in the `.env` database is `fallilou_yaram@gmail.com`, so Resend refused
  the send (and the token was deleted, as designed), while `murid.dieng@gmail.com`
  has no account, so nothing is sent to it. Not a code bug: to receive a reset
  in dev, the account must use the Resend owner's address, or a domain must be
  linked.
- 2026-10-04 — UX fix from the same test: after submitting, the card still said
  "Enter your email…" and the confirmation did not repeat the address. The page
  description is now neutral ("We will email you a link to choose a new one."),
  the confirmation reads "Check your inbox" with the submitted address, and a
  "Use a different email" button brings the form back. `tsc --noEmit` and lint
  green; not re-checked in a browser (the author's dev server holds `.next`).
- 2026-10-04 — Console noise, added to this branch at the author's request. (1)
  Auth.js logged every refused sign-in as `[auth][error] CredentialsSignin` with a
  full stack. `src/auth.ts` now sets `logger.error` to skip `CredentialsSignin`
  (which also covers `EmailNotVerifiedError`), and passes any other error to
  `console.error`. The default logger is not exported, so its colour and
  `[auth][cause]` formatting are not reproduced, but the error object with its
  stack and cause still is. (2) Base UI warned that the default value of an
  uncontrolled field changed when the sign-in form put the email back after a
  failure; the email `Input` now has `key={state.email}`, so it is remounted
  instead. Checked against the author's running dev server with two wrong-password
  sign-ins on the demo account: the email is kept, 0 Base UI warnings. Control
  run without the `key`: 1 warning, so the server had reloaded. The server-side log
  change is only typechecked here; the author's terminal is what shows it.
  `tsc --noEmit` and lint green.
- 2026-10-04 — Forgot Password completed and merged into `main` (`7806dd6`,
  fast-forward); branch `feature/forgot-password` deleted, never pushed. Final
  `npm run build` and lint green, run alongside the author's dev server (Next 16
  writes `next dev` output to `.next/dev`, so they don't conflict); only the
  build output was deleted afterwards, `.next/dev` was kept. The author received
  a real reset email at the Resend owner's address. **Not verified:** a link
  clicked from that inbox was reported only as "received"; the server-side
  logger change was not seen in a terminal. **Still open:** a Resend domain (until
  then only `murid.dieng@gmail.com` receives mail), session revocation after a
  reset (needs a `passwordChangedAt` migration), rate limiting beyond the
  per-address throttle, the phase 4 hardening list. `next.config.ts` still
  carries the author's uncommitted edits.
- 2026-10-04 — Started Profile Page on branch `feature/profile-page`, with the
  author's decisions (see the Notes). `src/app/dashboard/` moved under the route
  group `src/app/(app)/`: `layout.tsx` (renamed `AppLayout`) is now the shell for
  `dashboard/` and the new `profile/`, URLs unchanged, history kept by `git mv`.
  `src/proxy.ts` matches `/profile/:path*` too. `zod@4.6.5` installed.
  `alert-dialog` added through shadcn, and the same registry bug as before came
  back: it imported `cn` from an npm package named `cn` and installed it. The
  import was pointed at `@/lib/utils` and the package uninstalled. shadcn's
  prompt to overwrite `button.tsx` was answered no.
- 2026-10-04 — Data: `src/lib/db/profile.ts` holds `getProfile` (returns
  `hasPassword`, never the hash; `null` when the row is gone) and
  `getProfileStats` (two counts plus one `item.groupBy` on `typeId`, folded onto
  the 7 system slugs in the spec's order; a custom type that reuses a system slug
  adds to that row). Actions in `src/actions/profile.ts`, validated with Zod and
  returning `{ success, error }`: `changePassword` (bcrypt check of the current
  password, 12 rounds, and drops pending `reset@` tokens) and `deleteAccount`
  (refuses `DEMO_USER_EMAIL`, now exported from `collections.ts`; requires the
  typed email; one transaction deleting items, then the address's tokens, then
  the user; `signOut` after, outside the try). The page reads `auth()` and
  redirects to `/sign-in` when the session has no user row.
- 2026-10-04 — Verified in a browser (Playwright script) against `next dev` on
  the `.env` database. An anonymous `/profile` gets a 307 to
  `/sign-in?callbackUrl=%2Fprofile`. A test user seeded with 2 snippets, 1 link,
  1 item of a custom `recipe` type and 1 collection showed name, email, "Member
  since October 4, 2026", initials `PT`, Items 4, Collections 1, and the 7 rows
  `Snippets 2 / Prompts 0 / Notes 0 / Commands 0 / Links 1 / Files 0 / Images 0`.
  Change password: a wrong current password, a mismatch and a short one each
  showed their error; the right one showed the "Password changed." toast,
  cleared the fields and removed the pending reset token, and the new password
  signed in. Delete: the button stays disabled while the field is empty or holds
  another address, the field clears on reopen, and matching is case- and
  space-insensitive. Deleting landed on `/sign-in`, and left 0 items, 0
  collections, 0 custom types, 0 tokens and no orphaned rows (so the `Restrict`
  path held). A second browser still holding the deleted user's JWT is sent to
  `/sign-in` from `/profile`. Demo account: Items 18, Collections 5, rows
  4/3/0/5/6/0/0 (sum 18), delete disabled with the explanation. `/dashboard`
  renders in the shell, and the sidebar avatar opens `/profile` with the sidebar
  present. No browser console errors. `tsc --noEmit`, lint and `npm run build`
  green; `.next` deleted.
- 2026-10-04 — Review fix: the typed-email check lowercased only the typed side.
  The adapter stores GitHub emails as GitHub returns them, so an address with
  capitals could never be deleted. Both the dialog and `deleteAccount` now
  lowercase the stored address too. Also added `(app)/profile/error.tsx` over
  `ErrorFallback`, so a failing profile query keeps the shell, as
  `dashboard/error.tsx` does. Verified with a passwordless user stored as
  `Gh.Test@Example.com`, signed in through a session cookie minted with
  `encode` from `@auth/core/jwt` (salt and cookie name `authjs.session-token`):
  `/profile` shows "You sign in with GitHub, so there is no password to change."
  and no form; typing `gh.test@example.com` enables the delete, which removed the
  row and landed on `/sign-in`. `tsc --noEmit`, lint and `npm run build` green
  again. **Not verified:** the server-side demo refusal in `deleteAccount`, since
  the button is disabled and only the client guard was exercised; a real GitHub
  OAuth sign-in.
- 2026-10-04 — Author feedback. (1) The sidebar user dropdown now has a
  **Profile** item above **Sign out**, with a separator: `DropdownMenuItem`
  rendered as a `next/link` (`render={<Link href="/profile" />}`), so it is an
  `<a href="/profile">` with client navigation and the menu closes on click.
  (2) The page was pinned to the left by `max-w-3xl`, leaving a large empty area
  on the right. It now uses the full width: the identity card spans it, and
  from `xl` up Usage and Account sit in two columns (`items-start`, so the shorter
  column does not stretch); below `xl` they stack. The password form lost its
  `max-w-sm` so it fills its card. Checked in a browser as the demo user: the
  menu lists `Profile`, `Sign out`, and the item navigates to `/profile` and
  closes; at 1440 px the main area is 1184 px wide with the two sections at
  x=280 and x=864 (552 px each); at 1100 px they stack at 796 px. No console
  errors. `tsc --noEmit`, lint and `npm run build` green; `.next` deleted.
- 2026-10-04 — Author feedback: the password form should not sit open on the
  page. It is now a **Change password** button that opens a modal
  (`ChangePasswordDialog`, replacing `ChangePasswordForm`), built on shadcn's
  `dialog`, which had the same `cn` registry bug as `alert-dialog` (fixed the same
  way, the stray package uninstalled again, `button.tsx` overwrite refused). The
  form lives inside the popup, so it unmounts on close and every opening starts
  empty; on success the modal closes and the toast shows. Checked in a browser
  with a test account: no password inputs on the page until it opens; a wrong
  current password shows its error inside the modal; Cancel and Escape both
  close it; reopening is empty with no error; the right password closes it,
  shows "Password changed." and changes the stored hash. The modal is fully
  opaque once its open animation ends (an earlier screenshot caught it
  mid-fade). Test user deleted. `tsc --noEmit`, lint and `npm run build` green;
  `.next` deleted.
- 2026-10-04 — `/feature review`: all Goals met, no scope creep. Three fixes,
  applied at the author's request. (1) `ChangePasswordDialog` passed a new
  `onSuccess` arrow on every render into the success effect's dependencies. Only
  one toast showed, but only because the author's uncommitted
  `reactCompiler: true` memoises it. `onSuccess` is now a `useCallback`. (2)
  `DeleteAccountDialog` kept its action state outside the popup, so a server
  error stayed visible after closing and reopening. The form is now a
  `DeleteAccountForm` inside the popup, like the password modal, which also
  replaces the manual `onOpenChange` reset. (3) The actions built token
  identifiers from `user.email` as stored, while `password-reset.ts` lowercases
  them; both actions now lowercase. Re-checked in a browser: delete (field
  empty on reopen, disabled until it matches, the account, its 4 items,
  collection, custom type and seeded `reset@` token all gone), and the password
  modal flow unchanged. `tsc --noEmit`, lint and `npm run build` green; `.next`
  deleted. The author asked for `context/features/profile-spec.md` to go into
  the feature commit.
- 2026-10-04 — Profile Page completed and merged into `main` (`026ceb4`,
  fast-forward); branch `feature/profile-page` deleted, never pushed. The spec
  file went into the commit, at the author's request. **Not verified:** the
  server-side demo refusal in `deleteAccount` (only the disabled button was
  exercised); a real GitHub OAuth sign-in (the passwordless view was checked
  with a minted session cookie). **Still open:** the dashboard and sidebar
  still read the demo account through `getDemoUserId()` (the author will ask
  for its removal); a password change or reset does not end other sessions; no
  maximum password length; no rate limiting on current-password checks; the
  `/items/*` and `/collections` pages still 404, though the `(app)` route group
  they need now exists; shadcn's registry imports `cn` from an npm package
  named `cn` on every `add`, so check each generated file. `next.config.ts`
  still carries the author's uncommitted edits.

Left undone by the database feature:

- ~~**NextAuth is installed but not configured.**~~ — configured for GitHub in the
  auth phase 1 feature (see the History). Still open: the Credentials provider and
  registration (phase 2), and replacing the demo-user shim with the session
  user (the sign-in / register UI shipped in phase 3).
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
- Browser checks now work (`libgbm` is installed). The Playwright MCP wants Google
  Chrome at `/opt/google/chrome/chrome`, which is not installed, so it fails; a
  plain Playwright script (`playwright@1.63.0`, installed in the scratchpad, using
  the cached Chromium) drives the app instead. Wait on `location.pathname`, not
  `waitForURL`, which mishandles Next's soft navigations.
- Pushing to GitHub is the author's step; WSL has no stored GitHub credentials.
- 2026-10-05 — Started Auth Audit Fixes on `fix/auth-audit-findings`: sessions
  end after a password change / reset (`User.passwordChangedAt`, migration
  `20261005012806_add_password_changed_at` on develop), uniform register
  response with an account-exists email, dummy-hash compare in `authorize`.
  Change password re-issues the current session and redirects to
  `/profile?passwordChanged=1`: re-rendering in place reads the old cookie from
  the request headers. Build and lint green; two-browser Playwright check passed.
- 2026-10-05 — Auth Audit Fixes merged into `main` and pushed. Production still
  needs migration `20261005012806_add_password_changed_at`. Still open from the
  audit: rate limiting (High) and password confirmation on account deletion
  (Low). Feature completed.
- 2026-10-05 — Rate Limiting for Auth merged into `main`. `src/lib/rate-limit.ts`
  (`@upstash/ratelimit`, sliding window, fail-open, 2 s timeout). Sign-in is
  limited inside the Credentials `authorize()` (IP + normalized email), which
  covers both the `signInWithCredentials` action and a direct POST to
  `/api/auth/callback/credentials`; `RateLimitedError` carries `reset` to the
  action, and the form shows it as a toast. Register / forgot-password /
  reset-password are limited by IP before the body is read, resend-verification
  by IP + email; they answer 429 with `Retry-After`. Verified on the dev server
  with curl, Playwright and a bogus token (fail-open). The IP comes from
  `x-forwarded-for`, which Vercel overwrites, so it is only spoof-proof there.
  Production needs `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` set on
  Vercel, otherwise limiting is silently off. `.env.example` (gitignored) lists
  them locally. Still open from the audit: password confirmation on account
  deletion (Low). Feature completed.
- 2026-11-06 — Items List View merged into `main`. `/items/[type]` maps the plural
  URL segment back to a slug with `itemTypeFromSegment`, reads through
  `getItemsByType` (capped at `MAX_ITEM_LIMIT`, no pagination yet) and renders
  `ItemCard`s, two columns from `md` up, with the left border from `borderClasses`.
  `/items` joined the proxy matcher. The spec was silent on three things, and the
  defaults were never confirmed: the session user's items (the dashboard still
  reads the demo account), a 404 for an unknown type, and a "No notes yet." empty
  state. Verified with Playwright as the demo user only, so isolation between
  accounts and the file size line on cards were not exercised. `sidebarTypes` still
  omits Command, so `/items/commands` has no sidebar link. Feature completed.
- 2026-11-07 — Item Type Color Fixes merged into `main`. `amber` and `yellow` were
  about 8° of hue apart and looked the same at the 6% tint, so Link moved to `lime`.
  `ItemCard` now uses `washClasses` and `ringClasses`, and `borderClasses` is gone.
  Migration `20261107000000_link_color_lime` updates the system row and is applied
  on `develop` only. Production needs `prisma migrate deploy`, because `next build`
  does not run it and a row still on `yellow` loses its accent. Verified with
  Playwright against a production build using the develop database. Still open: the
  sidebar's `/collections` link has no route, and its prefetch requests stay open.
  Feature completed.
- 2026-11-07 — Vitest Unit Testing merged into `main`. 93 tests in `src/actions` and
  `src/lib`, in a Node environment with the database, Upstash and Resend credentials
  blanked. Pinned to `~4.0.18`: npm crashes resolving 4.1.12 here, and 5.x needs
  `@types/node` 22. Installed and run through Windows npm, because Rollup's Linux binary
  is not in `node_modules`. `/feature complete` now runs tests, build and lint first and
  stages files by name. Not covered yet: `verification.ts`, `password-reset.ts`, the
  `src/lib/db` queries other than `limits.ts`, and Upstash erroring once configured.
  `.test.tsx` files are ignored. Known bug, not fixed: `toItemTypeSlug` and `toColorToken`
  use `in`, so they accept inherited keys like `constructor`; nothing can reach this
  until custom types exist. Feature completed.
- 2026-11-07 — Account Deletion, Commands Sidebar and Slug Fixes merged into `main`.
  `deleteAccount` requires the password for accounts that have one, which closes the last
  open finding in `docs/audit-results/AUTH_SECURITY_REVIEW.md`. That report still lists
  fixed findings and needs a fresh audit run before it is published. `sidebarTypes` now
  includes Command, and `toItemTypeSlug` and `toColorToken` use `Object.hasOwn`. Verified
  in a browser on `develop` with a throwaway account, removed afterwards. The dialog for
  GitHub-only accounts was only covered at the action level. Still open: password checks in
  `deleteAccount` and `changePassword` have no attempt limit, and the sidebar's `/collections`
  link has no route. Feature completed.
- 2026-11-07 — Token Flow and Account Isolation Tests merged into `main`. 162 tests in total,
  with no source changes and no new bugs in the token flows. A browser check on `develop` with
  a throwaway second account showed `/items` and `/profile` keep accounts apart. It also
  confirmed the dashboard and sidebar still read the demo account through `getDemoUserId` for
  everyone, so a new user sees demo data there and not their own items. Fix that before a real
  launch. Feature completed.
- 2026-11-07 — Instant Navigation Feedback merged into `main`. A sidebar click now shows
  `PageSkeleton` in 60-85 ms; the content still takes about 0.85 s from a local machine, mostly
  round trips to `us-east-2`. `loading.tsx` is per route because in `(app)` it did not show
  again between item types. The type check moved to `items/[type]/layout.tsx`, above the
  boundary, to keep a real 404. The sidebar's `Suspense` is inside `Sidebar`, because around it
  the mobile variant caused hydration error #418. A session whose account is gone now gets a 200
  and a client redirect rather than a 307. The same investigation found the old Upstash host no
  longer existed, which cost seconds per sign-in and left rate limiting off; the author replaced
  it in `.env`, and blocking from the 6th attempt was confirmed. Vercel's values are unchecked.
  Still open: a database outage lands on the sign-in page instead of an error, a 6 px overflow on
  phones after navigating, and the collapsed sidebar not persisting. Feature completed.
- 2026-11-07 — Started Item Drawer on branch `feature/item-drawer`. Added `getItemDetail` (looks up
  by id and owner together), `GET /api/items/[id]` (401 when signed out, 404 for a missing item or
  someone else's) and `ItemDrawerProvider`, `ItemDrawerTrigger` and `ItemDetails`. The trigger is an
  overlay button because a button may not contain the cards' headings. The provider wraps the lists
  on each page rather than sitting in `(app)/layout.tsx`, so the drawer closes on navigation without
  extra code. `/dashboard` now awaits `auth()` before rendering, which adds one user lookup ahead of
  every section; the cost was not measured. Verified: 166 unit tests, typecheck, lint and the build
  (`ƒ /api/items/[id]`), then 27 Playwright checks under `next start` with `.env`'s `DATABASE_URL`,
  covering the skeleton, copy, keyboard and focus, a stale response, the error state, mobile, and a
  throwaway second user, deleted afterwards and confirmed gone. **Not verified:** the layout against
  the design, as the screenshot is missing; the route handler has no unit test, as Vitest does not
  collect it. **Found on the way, not caused by this:** under `next start`, Upstash answers
  `WRONGPASS` to the token from `.env.production`, so sign-in rate limiting fails open there.
- 2026-11-07 — Drawer speed. The author saw the content take about 1 s. Measured on a production
  build: 720 ms for clicks in quick succession and **1.7 s after a 20 s pause**, which is what a
  person actually does. Each statement is a 160-170 ms round trip from this machine, and the session
  check costs one. `getItemDetail` cost three, because Prisma loads a nested select level by level (5
  statements, even for an id that does not exist). After a pause the pool also has to reconnect,
  about 1 s more. A benchmark that clicks back to back hides that entirely. Fixed the first cause:
  the drawer now takes the whole card from the trigger and shows its fields at once (5-30 ms), and
  `getItemDetail` runs two flat queries in parallel, both filtered by owner. Content now arrives in
  about 415 ms back to back and 1.35 s after a pause. **Left for a separate fix:** a longer
  `idleTimeoutMillis` in `src/lib/prisma.ts`. In a script, with the 5-minute test value, it brought the
  server time after a pause from 1 260 ms to about 340 ms, but it affects the whole app and has not
  been tried on Vercel. Also from the review: `No items yet.` replaces the empty `0 of 0`,
  `contentType` and `fileUrl` are no longer returned, and the skeleton has `role="status"`. `isWebUrl`
  moved to `src/lib/utils.ts` so it could be tested. Verified: 180 unit tests, typecheck, lint, the
  build, and 30 Playwright checks, including the back button, long content, real sorted tags and
  isolation in both directions, with throwaway accounts deleted afterwards. File rows and an unsafe
  URL were only checked with a mocked response.
- 2026-11-07 — Double click fix. A double click on an item opened the drawer and closed it at once:
  the second click landed on the backdrop the first one had just opened, and Base UI closed on that
  `outside-press` (a `click` event with `detail` 2, confirmed by tracing the events and the
  `onOpenChange` reason). `handleOpenChange` now cancels an outside press whose `detail` is above 1.
  A single click on the backdrop, the close button and Escape still close it, and checking the click
  count avoids a timing guess. Verified in dev with 8 Playwright checks, plus tests and the build.
  Not tested: a double tap on a touch screen. Earlier the author also reported the content stuck on
  the skeleton and a 404 on `/dashboard`. Neither could be reproduced, both went away without a code
  change, and the cause is unknown.
- 2026-11-07 — Item Drawer completed and merged into `main` (`1965c5f`, fast-forward); branch
  `feature/item-drawer` deleted. It was never pushed. Shipped: `GET /api/items/[id]`,
  `getItemDetail` (two flat queries in parallel, both filtered by owner), `ItemDrawerProvider`,
  `ItemDrawerTrigger`, `ItemDetails`, and `isWebUrl` in `src/lib/utils.ts`; 180 unit tests. The
  author ran `complete` without answering the three defaults explicitly, so they stand as built:
  only Copy works, the dashboard's item lists read the session while stats, collections and the
  sidebar still read the demo account, and the layout was never compared with a design.
  **Still open:** the connection-pool fix (`idleTimeoutMillis`, to be tried on Vercel), which
  would bring content after an idle pause from about 1.35 s down toward 0.4 s; a unit test for the
  route handler, which needs a Vitest config change; a double tap on touch screens; and removing
  the demo-user shim. A `.git/index.lock` held by another process blocked the merge once and
  cleared by itself; it was not deleted.
- 2026-11-08 — Item Drawer Edit Mode completed and merged into `main` (`b0844ae`, fast-forward);
  branch `feature/item-drawer-edit` deleted. It was never pushed. Shipped: the `updateItem` server
  action (`src/actions/items.ts`, Zod-validated, returns the field at fault on a validation error)
  and the `updateItem` query (one `update` filtered by owner, tags replaced via `connectOrCreate`
  scoped to the user, returns `{ card, detail }` rather than the spec's `ItemDetail` so the drawer
  heading refreshes), `ItemEditForm`, a `Textarea` primitive; 198 unit tests. Content is kept as
  typed (only whitespace-only clears it); the advisor caught an early version that trimmed it.
  Design pass approved by the author: type-colored icon in the header, "Edit <type>" heading,
  Save/Cancel footer, errors at the field plus a toast, tag badges while typing, tooltips on the
  icon buttons (also the disabled ones), icons on the detail rows. App-wide, toasts moved to the
  bottom left and errors are red. Verified with Playwright on `next start` against the develop
  branch (`AUTH_TRUST_HOST=true` and `.env`'s `DATABASE_URL` passed explicitly). A test run removed
  the author's `docker` tag from the Dockerfile snippet; it was relinked and the test tag
  `e2e-tag` deleted, with the author's approval. **Known and accepted:** at phone width the toast
  covers the Save/Cancel footer for about 4 s. **Not tested:** the stale-save guard, notes, files
  and images (the demo account has none), and a real save of content with leading or trailing
  whitespace.
- 2026-11-08 — Item Delete completed and merged into `main` (`0bc274b`, fast-forward); branch
  `feature/item-delete` deleted. It was never pushed. Shipped: the `deleteItem` server action
  (`src/actions/items.ts`) and the `deleteItem` query (one `delete` filtered by owner, so another
  user's item or a missing one is P2025 → "This item no longer exists."), `ItemDeleteDialog`
  (controlled `AlertDialog`, pending state, cannot close while the delete runs), and an
  `onDeleted` callback that closes the drawer, guarded like `handleSaved`; 204 unit tests (6 new).
  Verified with Playwright on `next start` against the develop branch, using a throwaway item
  that was then removed: Escape/Cancel close only the dialog, a backdrop click closes neither,
  the row and its `ItemTag` link are gone while the tag stays, Recent goes from "10 of 19" to
  "10 of 18", and a row removed behind the UI gives the error toast with the dialog still open.
  **Known:** the deleted card stays on the dashboard for about 3.6 s until `router.refresh()`
  lands, and opening it then shows "could not be loaded"; removing it optimistically would fix
  that. After a P2025 the dialog stays open on the missing item (Cancel only). **Not tested:**
  the stats card numbers (inferred to update with the same refresh) and reaching
  `/items/[type]` by a sidebar click rather than a fresh load.
- 2026-11-08 — Item Create completed and merged into `main` (`aab5ad8` feat, `35de7dc` fix,
  fast-forward); branch `feature/item-create` deleted. It was never pushed. Shipped: the
  `createItem` server action (`src/actions/items.ts`), a Zod discriminated union with one shape per
  type (snippet, prompt, command, note, link), so unused fields are stripped and file, image and
  custom types are refused; a blank link URL gives "URL is required.". The `createItem` query
  resolves the system `ItemType` with `findFirst({ slug, userId: null, isSystem: true })` (the
  `[userId, slug]` unique cannot be queried with a null) and links deduplicated tags with
  `connectOrCreate`. `NewItemDialog` (client leaf in the server `TopBar`): coloured type radios from
  a new `typeColors` map in `item-type-ui.ts` (a copy of the seeded colours, since the top bar
  cannot wait on data), fields per type, `Field`/`toTags` reused from `ItemEditForm`, cannot close
  while saving. 229 unit tests (24 new). Also, in a separate `fix:` commit requested during the
  feature: drawer actions show icon + label (Delete stays icon only, red on hover), and the delete
  confirmation has a red warning icon and a solid red Delete button. Verified with Playwright on
  the author's `next dev` (develop branch): fields per type, the disabled Create, the invalid-URL
  error, toast + close + refresh, the drawer showing the new link and its deduplicated tag, the red
  hover and confirmation; test items were deleted through the UI. **Known:** the dashboard
  overflows horizontally at 375 px (622 px wide), from the item cards, before this feature too.
  `DeleteAccountDialog` still uses the tinted `destructive` button. The type radios have no
  arrow-key navigation. The Free plan's 50-item limit is not enforced on create.

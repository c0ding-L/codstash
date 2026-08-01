# Current Feature

Database — Prisma 7 + Neon PostgreSQL

Spec: `@context/features/database-spec.md`

## Status

In Progress

## Goals

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

Backlog from the dashboard series:

- The seven `/items/TYPE` links return 404 — the phase 2 spec asked for links,
  not pages. Fix is a `src/app/(dashboard)/` route group so `/items/*` inherits
  the shell without changing URLs. It touches phase 1 files, so it needs a
  decision.
- Sidebar collections render as buttons, not links; no collection route exists.
- `/` still renders the placeholder `<h1>Codstash</h1>`; whether it should
  redirect to `/dashboard` is unanswered.

Environment notes that outlive any one feature:

- npm must be run from WSL. `node_modules/.bin` holds Unix symlinks only, so
  `npm run dev` from Windows fails with "'next' n'est pas reconnu".
- Chromium cannot launch here (`libgbm.so.1` missing, sudo required), so
  browser verification is the author's step.
- Pushing to GitHub is the author's step; WSL has no stored GitHub credentials.

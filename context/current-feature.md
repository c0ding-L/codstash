# Current Feature

Mock data source of truth

## Status

Completed

## Goals

Single source of truth for mock data, used by the dashboard UI until the database
(Neon + Prisma) is wired up.

- One file: `src/lib/mock-data.ts`
- Covers: users, item types, collections, items, tags
- Shapes mirror the Prisma draft in `project-overview.md` so the swap to real
  queries is mostly a change of import
- Values reproduce `context/screenshots/dashboard-ui-main.png` so the dashboard
  can be built against realistic content

## Notes

Derived from the design mock:

- 8 collections, item counts summing to **306** (matches the "Total Items" card)
- 3 favorite collections (matches the "Favorites" card)
- 7 system item types: Snippet, Prompt, Note, Command, File, Image, Link
- "Recent" sidebar = the 5 most recently updated collections

Deliberate deviations, all reversible:

- `Collection.itemCount` is **denormalized** to match the mock. The `items`
  array is a representative sample (~18 items), not all 306 — counting the
  array will not reproduce `itemCount`.
- Timestamps are **fixed ISO strings** anchored to 2026-08-01 rather than
  computed relative to `Date.now()`. The dashboard is statically prerendered,
  so a relative anchor would freeze at build time anyway while adding
  nondeterminism.
- Tags use a flat `tagIds` array on `Item` instead of the `ItemTag` join table
  from the Prisma draft. The join table only matters once the DB exists.
- Types are colocated in `mock-data.ts` rather than `src/types/` as
  `coding-standards.md` prescribes, because the request was explicitly for a
  single file.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-08-01 — Created `src/lib/mock-data.ts` on branch `feature/mock-data`.
- 2026-08-01 — Mock user renamed to CodStash / CS to match the logo.
- 2026-08-01 — Merged into `main` (`3cb0917`). Build, typecheck and lint green.

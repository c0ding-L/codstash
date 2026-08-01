# Current Feature

Dashboard UI — Phase 3 (main area)

Spec: `@context/features/dashboard-phase-3-spec.md` (phase 3 of 3)

## Status

Completed

## Goals

<!-- Goals & requirements -->

## Notes

<!-- Any extra notes -->

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
  Date()` would freeze at build time and drift. Labels render exactly as the
  design shows — 2h ago, 5h ago, Yesterday, 3d ago, 1w ago, 2w ago.
- 2026-08-01 — Stats cards follow the spec (items, collections, favorite items,
  favorite collections) rather than the screenshot's Collections / Total Items
  / Favorites / Last Updated, as the spec directs. Only 2 items are pinned, so
  that section is sparse next to the 10 recent ones.
- 2026-08-01 — A leftover phase 2 dev server held port 3000 and served a stale
  page; an identical byte count gave it away. Checking response content, not
  just the HTTP status, is what catches this.
- 2026-08-01 — Phase 3 completed. Build, typecheck and lint green; verified
  against the served HTML — card values 306 / 8 / 3 / 3, exactly 5 collection
  cards, 12 item rows (2 pinned + 10 recent). The three-phase dashboard UI is
  done.

Backlog after the dashboard series:

- The seven `/items/TYPE` links return 404 — the phase 2 spec asked for links,
  not pages. Fix is a `src/app/(dashboard)/` route group so `/items/*` inherits
  the shell without changing URLs. It touches phase 1 files, so it needs a
  decision.
- Sidebar collections render as buttons, not links; no collection route exists.
- `/` still renders the placeholder `<h1>Codstash</h1>`; whether it should
  redirect to `/dashboard` is unanswered.
- Mock data is still imported directly everywhere. Swapping to Neon + Prisma
  means changing those imports, which is why the shapes mirror the Prisma
  draft.

Environment notes that outlive any one feature:

- npm must be run from WSL. `node_modules/.bin` holds Unix symlinks only, so
  `npm run dev` from Windows fails with "'next' n'est pas reconnu".
- Chromium cannot launch here (`libgbm.so.1` missing, sudo required), so
  browser verification is the author's step.

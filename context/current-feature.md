# Current Feature

Dashboard UI — Phase 2 (sidebar)

Spec: `@context/features/dashboard-phase-2-spec.md` (phase 2 of 3)

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
- 2026-08-01 — Started Dashboard UI Phase 1 (layout shell).
- 2026-08-01 — ShadCN initialized (style `base-nova`, `@base-ui/react`, lucide);
  added `button` and `input`. `/dashboard` route, top bar and placeholders in
  place. Build, typecheck and lint green.
- 2026-08-01 — Fonts: shadcn scaffolds `@theme inline { --font-sans:
  var(--font-sans) }`, which is self-referential and invalid at computed-value
  time, so `@apply font-sans` resolved to nothing. Fixed by keeping the
  next/font variables named `--font-geist-sans` / `--font-geist-mono` and
  pointing the theme keys at them. `--font-mono` added at the same time, which
  phase 2 needs for syntax highlighting. Verified in the compiled CSS.
- 2026-08-01 — Browser check could not be run in this environment: Chromium is
  missing `libgbm.so.1` and installing it needs sudo. Verified via the compiled
  CSS instead (dark tokens emitted, utilities present), then reviewed in a
  browser by the author.
- 2026-08-01 — Phase 1 merged into `main` (`fe8d169`) and pushed (`22753c6`).
  Feature completed. `min-h-svh` on the dashboard container left as-is despite
  being redundant with `flex-1`.
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
  inside the header would vanish when collapsed, leaving no way to reopen. One
  control now serves both desktop collapse and the mobile drawer.
- 2026-08-01 — `npm run lint` failed on shadcn's generated `use-mobile.ts`
  (`react-hooks/set-state-in-effect`). Rewritten with `useSyncExternalStore`,
  the fitting primitive for a media query. Same behaviour, no cascading render.
  May need reapplying if shadcn regenerates the file.
- 2026-08-01 — Phase 2 completed. Build, typecheck and lint green; sidebar
  contents verified against the served HTML and reviewed in a browser by the
  author.

Still open, for phase 3:

- The seven `/items/TYPE` links 404 — the spec asked for links, not pages.
  Fix is a `src/app/(dashboard)/` route group so `/items/*` inherits the shell
  without changing URLs. Touches phase 1 files, so it needs a decision.
- Collections in the sidebar render as buttons, not links; no collection route
  is specified yet.
- `/` still renders the placeholder `<h1>Codstash</h1>`; whether it should
  redirect to `/dashboard` is unanswered.
- `dashboard-phase-3-spec.md` does not exist yet.
- The main area is still the phase 1 `<h2>Main</h2>` placeholder.

Environment notes that outlive any one feature:

- npm must be run from WSL. `node_modules/.bin` holds Unix symlinks only, so
  `npm run dev` from Windows fails with "'next' n'est pas reconnu".
- Chromium cannot launch here (`libgbm.so.1` missing, sudo required), so
  browser verification is the author's step.

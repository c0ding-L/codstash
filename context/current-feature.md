# Current Feature

Dashboard UI — Phase 1 (layout shell)

Spec: `@context/features/dashboard-phase-1-spec.md` (phase 1 of 3)

## Status

In Progress

## Goals

Stand up the dashboard shell. Structure and chrome only — the sidebar and main
area stay as placeholders until phases 2 and 3.

- Initialize ShadCN UI and install the components this phase needs
- Dashboard route at `/dashboard`
- Main dashboard layout plus any global styles it requires
- Dark mode by default
- Top bar with search and a "New Item" button, **display only** (no behavior)
- Sidebar and main area are placeholders: an `h2` reading "Sidebar" and one
  reading "Main"

## Notes

References:

- `@context/screenshots/dashboard-ui-main.png` — target design; does not need
  to be pixel perfect
- `@context/project-overview.md` — UI/UX section (dark mode first, collapsible
  sidebar, inspired by Notion / Linear / Raycast)
- `@src/lib/mock-data.ts` — available, but this phase renders placeholders, so
  it is mostly wiring for phase 2

Constraints to keep in mind:

- **Tailwind v4**: configuration lives in CSS. Do not create `tailwind.config.ts`
  — theme tokens go in an `@theme` block in `src/app/globals.css`, per
  `coding-standards.md`.
- `src/app/globals.css` currently holds only `@import "tailwindcss";`. ShadCN
  init will add its own token layer here.
- Server components by default; `'use client'` only where interactivity
  demands it. Nothing in this phase is interactive yet.
- The root layout still declares Geist / Geist Mono but nothing maps them to
  Tailwind's `font-sans` / `font-mono`. Worth resolving while adding the
  global styles.

Open questions:

- `dashboard-phase-2-spec.md` and `dashboard-phase-3-spec.md` are referenced by
  the phase 1 spec but do not exist yet in `context/features/`.
- The spec does not say whether `/` should redirect to `/dashboard`. Currently
  `/` renders the placeholder `<h1>Codstash</h1>`.

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
  CSS instead (dark tokens emitted, utilities present). Needs a human look.

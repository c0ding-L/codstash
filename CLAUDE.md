# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# CodStash

A developer knowledge hub for snippets, prompts, commands, notes, files, images, links and custom item types.


## Context Files

Read these for full project context:

- @context/project-overview.md: Features, data models, tech stack, UI/UX
- @context/coding-standards.md: Code conventions and patterns
- @context/ai-interaction.md : Workflow and communication guidelines
- @context/current-feature.md: What we are currently working on

## Commands

```bash
npm run dev     # dev server on :3000
npm run build   # production build — the real typecheck (runs tsc) and the closest thing to a test suite
npm run start   # serve the production build
npm run lint    # eslint (flat config)
```

There is **no test framework installed** — no `npm test`, no vitest/jest/playwright. Do not
invent a test command. To verify a change, run `npm run build` (it compiles, typechecks, and
prerenders every route) and `npm run lint`.

`tsc` is not exposed as a script; `npx tsc --noEmit` works if you want typecheck without the
full build.

## Stack

- **Next.js 16.2.12, App Router**, React 19.2. Builds run on **Turbopack** by default in 16 —
  the build output confirms this, and no `--turbopack` flag is needed.
- **TypeScript strict mode**, `noEmit`. Import alias `@/*` → `./src/*`.
- **Tailwind CSS v4** via the `@tailwindcss/postcss` PostCSS plugin.

Read `node_modules/next/dist/docs/` before writing Next-specific code — see AGENTS.md. The
App Router guides are under `01-app/01-getting-started/`, topic guides under `01-app/02-guides/`.

## Layout

Routes live in `src/app/` (note the `src/` prefix — not a top-level `app/`). `layout.tsx` is
the required root layout; it loads Geist/Geist Mono via `next/font/google` and imports
`globals.css`.

## Styling

Tailwind v4 is configured **entirely in CSS** — there is no `tailwind.config.ts`. `src/app/globals.css`
currently contains only `@import "tailwindcss";`. Theme tokens, if you need them, go in a
`@theme` block in that file rather than a JS config.

Two consequences of that bare globals.css worth knowing before you style anything:

- Tailwind's preflight resets headings, so `<h1>` renders at body size and weight until you
  add utilities.
- `layout.tsx` still sets `--font-geist-sans` / `--font-geist-mono` on `<html>`, but nothing
  maps them to Tailwind's `font-sans` / `font-mono`. Using those utilities gets the default
  stacks, not Geist, unless you add the `@theme` mapping back.

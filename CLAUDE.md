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
npm run build   # production build — the real typecheck (runs tsc)
npm run start   # serve the production build
npm run lint    # eslint (flat config)
npm test        # unit tests, one run (Vitest)
npm run test:watch  # unit tests, re-run on change
```

To verify a change, run `npm test`, `npm run build` (it compiles, typechecks, and prerenders
every route) and `npm run lint`.

`tsc` is not exposed as a script; `npx tsc --noEmit` works if you want typecheck without the
full build.

## Testing

Vitest runs in a Node environment and only picks up `src/actions/**/*.test.ts` and
`src/lib/**/*.test.ts`. **Server actions and utilities only — components are not tested**, so
there is no jsdom or Testing Library. Tests sit next to the file they cover.

- Mock `@/auth`, `@/lib/prisma` and `next/navigation` with `vi.mock`. Tests must never reach a
  real service: `vitest.config.mts` blanks `DATABASE_URL`, `RESEND_API_KEY` and the Upstash
  variables.
- `mockReset` is on, so set a mock's return value in the test or in `beforeEach`, not at module
  level.
- Vitest is pinned to `~4.0.18`. npm crashes resolving 4.1.12 in this project (`Cannot read
  properties of null (reading 'edgesOut')`), and 5.x needs `@types/node` 22 or newer.
- The author works on Windows, so `node_modules` is installed from there. Run `npm install` and
  `npm test` through Windows npm, because Rollup's Linux binary is not installed:
  `cmd.exe /c "E: && cd \PROGRAMMING\CODE\codstash && npm test"`.

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
imports `tailwindcss`, `tw-animate-css` and `shadcn/tailwind.css`, then holds the theme tokens in
an `@theme inline` block and the light/dark palettes as CSS variables. New tokens go there, not in
a JS config.

The `@theme` block maps `--font-sans` / `--font-heading` to `--font-geist-sans` and `--font-mono` to
`--font-geist-mono` (set on `<html>` by `layout.tsx`). Keep those pointing at the Geist variables:
shadcn scaffolds them as `var(--font-sans)`, which is self-referential and silently drops the font.

## Neon MCP

When using the Neon MCP tools for this repo, always target:

- **Project:** `codstash` — id `mute-feather-19856762`
- **Branch:** `develop` — id `br-divine-cake-aynaxj1z`
- **Database:** `neondb`

**Production is off limits.** The `production` branch (`br-morning-bread-ayrhs9aq`)
must never be touched — no reads, no writes, no schema changes, no branch
operations — unless I explicitly name production in that same message. An earlier
approval never carries over to a later request.

- This covers every tool, not just `run_sql`: `run_sql_transaction`,
  `get_database_tables`, `describe_table_schema`, `create_branch` /
  `delete_branch` / `reset_from_parent` / `restore_snapshot` /
  `set_default_branch` on production, `create_snapshot`, roles, endpoints,
  credentials, and so on.
- The project's **default** branch is `production`, so omitting `branch_id`
  silently hits it. Always pass `project_id` **and** `branch_id` explicitly on
  every call.
- If a request seems to need production, stop and ask instead of proceeding.

Other rules:

- Prefer read-only queries. Ask before any destructive or schema-changing
  statement (DROP, TRUNCATE, DELETE without a narrow WHERE, ALTER).
- Never change the schema through the MCP (no `run_sql` DDL, no
  `prepare_database_migration`). Schema changes go through
  `prisma migrate dev` in this repo, never `db push`.
- Table names are Prisma's, so quote them: `"Collection"`, `"Item"`, `"ItemType"`.
- Do not print or store connection strings or passwords.

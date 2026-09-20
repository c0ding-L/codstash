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

# C4 — CLI `cortex`

## Overview

A small command-line client for the REST API (C2), so the stash is reachable from the terminal:
search, print or copy, run a stored command with its variables filled, and save from stdin. It
lives in `cli/` in this repo and is published to npm by the author. Roadmap:
`docs/roadmap-v2.md` § C4.

Decided by the author on 2026-11-27: the binary is **`cortex`** (not `cod`: the project is being
renamed Cortex), published as `@<author-scope>/cortex-cli`. The unscoped `cortex` and
`cortex-cli` npm packages already install a `cortex` binary; the clash only hits a user who has
one of them, which is acceptable. The scope stays a placeholder in `cli/package.json` until the
author publishes. The binary name lives in **one constant** in `cli/` (help text, messages), so a
late rename is a one-line change.

## Requirements

### Package

- `cli/package.json`:
  - `"type": "module"`, `"bin": { "cortex": "dist/cortex.js" }`, `"engines": { "node": ">=20" }`
  - `"files": ["dist"]`
  - its own `tsconfig.json`
- Build with `tsup` (single ESM file with a shebang). Dev dependencies only.
- **No runtime dependencies**:
  - arguments with `node:util` `parseArgs`
  - prompts with `node:readline/promises`
  - HTTP with global `fetch`
  - colours with plain ANSI codes, off when `NO_COLOR` is set or stdout is not a TTY
- It imports `src/lib/template-vars.ts` through a relative path at build time. tsup bundles it,
  so there is one parser for the web app and the CLI. That file must stay free of Next, React
  and `@/` imports (B's spec already requires it).
- The root `tsconfig.json` and ESLint config exclude `cli/`. Vitest:
  - Add `cli/src/**/*.test.ts` to `include` in `vitest.config.mts`.
  - Update the Testing section of CLAUDE.md to say so.

### Config

- Path:
  - `$XDG_CONFIG_HOME/cortex/config.json`, else `~/.config/cortex/config.json`
  - on Windows, `%APPDATA%\cortex\config.json`
- Content `{ baseUrl, token }`. Written with mode `0600` on POSIX.
- `CORTEX_TOKEN` and `CORTEX_URL` env vars override the file (for CI).
- Default `baseUrl`: the production URL, a constant committed in `cli/tsup.config.ts`
  (`PRODUCTION_URL`) and baked in at build time; `CORTEX_DEFAULT_URL` overrides it.

### Commands

| Command | What it does |
| --- | --- |
| `cortex login [--url <baseUrl>]` | Asks for the token (input hidden), calls `GET /api/v1/me`, saves the config, prints "Logged in as <name> (<Free/Pro>)". |
| `cortex logout` | Deletes the token from the config. |
| `cortex whoami` | `GET /me`. |
| `cortex search <query> [--type t] [--tag t] [--limit n] [--json]` | A table: short id, type, title, tags. `--json` prints the raw API data. |
| `cortex get <id> [--copy] [--raw]` | Prints the content (a link prints its URL). `--copy` copies through `pbcopy` / `clip.exe` / `wl-copy` / `xclip -selection clipboard`, whichever exists, otherwise an error. Fills variables like `run` unless `--raw`. |
| `cortex run <id \| query>` | Commands only. Resolves a query to one command (a numbered pick when there are several), prompts for each variable (default shown), **prints the final command and asks `Run? [y/N]`**, then runs it in the user's shell (`$SHELL -c`, or `cmd /c` on Windows) with stdio inherited, and exits with its code. Never runs without the confirmation. `--yes` skips it, with a warning in `--help`. |
| `cortex save [--type note] --title <t> [--tags a,b] [--language l] [file]` | Content from the file or from stdin. Prints the new id. Needs a write token (the API's 403 is shown clearly). |
| `cortex context <collectionId> [-o file]` | Writes A3's Markdown to stdout or to a file (`cortex context abc -o CONTEXT.md`). |
| `cortex --help`, `cortex <cmd> --help`, `cortex --version` | |

- Short ids:
  - The CLI shows `shortId(id)` for each item: the **last** 8 characters, as in A1. cuid
    prefixes are shared by items created together.
  - `get`, `run` and `context` accept a short id. For items, the API resolves it with
    `id endsWith`, scoped to the owner: the `GET /api/v1/items?idSuffix=` filter, already in
    C2's list.
  - For collections, the CLI resolves it itself: `GET /api/v1/collections` returns every
    collection (no pagination), matched with `endsWith`. No API change.
  - No match, or two or more, gives an error (the latter lists them).
- Errors:
  - The API's `{ error: { message } }` is printed in red, with exit code 1.
  - A network error says which URL failed.
  - 401 suggests `cortex login`.
  - 403 on `save` is explained: `insufficient_scope` (read-only token) or `pro_required`.

### Docs

- `cli/README.md`: install (`npm i -g …`), login, every command with an example, config path,
  env vars.
- `docs/api.md`: rename `$CODSTASH_URL` / `$CODSTASH_TOKEN` to `$CORTEX_URL` / `$CORTEX_TOKEN`
  in its examples, so the API docs and the CLI use the same names.

## Testing

- `cli/src/args.test.ts`: parsing for each command and errors on unknown flags.
- `cli/src/config.test.ts`: path resolution per platform (env injected), env override.
- `cli/src/api.test.ts` (`fetch` mocked): the bearer header, the error mapping, short-id
  resolution.
- `cli/src/run.test.ts`: variables filled, the confirmation required (prompt mocked), `--yes`,
  and exit-code propagation (spawn mocked).
- Manual, against `next dev` and develop:
  - `login`, `search`, `get --copy`
  - `run` on a command with variables
  - `save` from a pipe (`echo "x" | cortex save --title t`)
  - `context -o`
  - Run it on Windows (through cmd.exe) and on WSL.

## Notes

- Publishing (`npm publish` from `cli/`) is the author's step, after review. It is not part of
  the feature's merge.
- CLI messages are English for v1. (Default; FR later if asked.)
- Out of scope, a separate rename task: "CodStash Pro" in the API's messages, the repo and app
  package name. The `cstash_` token prefix never changes here: existing tokens and A6's
  `codstash` secret detector depend on it.

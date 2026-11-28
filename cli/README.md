# cortex

Your Cortex snippets, prompts and commands from the terminal: search them, print or copy them,
run a stored command with its variables filled in, and save new items from a file or a pipe.

It talks to the Cortex REST API (`docs/api.md` in the app's repo). Node 20 or newer, no runtime
dependencies.

## Install

```bash
npm i -g @devcortexio/cortex-cli
cortex --version
```

## Log in

Create an API token in the app under **Settings › API tokens**, then:

```bash
cortex login
# Token: (hidden)
# Logged in as Ada (Pro).
```

- A **Read** token is enough for everything except `save`, which needs a **Read + write** token
  and a Pro plan.
- `cortex login --url http://localhost:3000` points the CLI at another instance (a dev server,
  say). The URL is saved with the token.
- The token can be piped instead of typed: `echo "$TOKEN" | cortex login`.

## Commands

Every command has `--help`, e.g. `cortex run --help`.

### `cortex whoami`

Shows the token's owner and plan.

```bash
cortex whoami
# Ada <ada@example.com> (Pro)
```

### `cortex search <query> [--type t] [--tag t] [--limit n] [--json]`

Searches titles, descriptions, content and tags. The first column is the short id that the other
commands accept: the last 8 characters of the item's id.

```bash
cortex search docker --type command
# ID        TYPE     TITLE                 TAGS
# wxyz1234  command  Prune Docker          docker, cleanup

cortex search hook --tag react --limit 5 --json   # the API's raw data
```

### `cortex get <id> [--copy] [--raw]`

Prints an item's content; a link prints its URL. In a prompt or a command, each `{{variable}}` is
asked for (its default shown in brackets) and filled in.

```bash
cortex get wxyz1234
cortex get wxyz1234 --copy   # to the clipboard
cortex get wxyz1234 --raw    # variables left as written
```

`--copy` uses `pbcopy` on macOS, `clip.exe` on Windows and WSL, and `wl-copy` or `xclip` on
Linux.

### `cortex run <id | query> [--yes]`

Runs a stored command in your shell (`$SHELL -c`, or `cmd /c` on Windows). A query that matches
several commands shows a numbered list. Each variable is asked for, then the final command is
shown and only runs once you answer `y`:

```bash
cortex run "restart deploy"
#   1) a1b2c3d4  Restart a deployment
#   2) e5f6a7b8  Restart deployment (staging)
# Pick a command [1-2]: 1
# app: api
# ns [prod]:
#
#   kubectl rollout restart deploy/api -n prod
#
# Run? [y/N] y
```

`cortex` exits with the command's exit code. `--yes` (`-y`) runs without asking: the command
runs exactly as stored, unseen, so keep it for commands you trust, e.g. in scripts. Without a
terminal, `run` refuses unless `--yes` is given, and variables take their defaults.

A command holding control characters (terminal escapes, a lone carriage return, bidi overrides)
could show one thing and run another: `run` prints them escaped (`\x1b`, `\x0d`) and never runs
it, `--yes` or not.

### `cortex save --title <t> [--type note] [--tags a,b] [--language l] [file]`

Saves a new item from a file, or from stdin when no file is given, and prints its id. The type
defaults to `note`.

```bash
echo "docker system prune -af" | cortex save --type command --title "Prune Docker" --tags docker,cleanup --language bash
cortex save --type snippet --title "Debounce hook" --language typescript useDebounce.ts
```

### `cortex context <collectionId> [-o file]`

Writes a collection as a Markdown context file for an AI coding assistant, the same file as
**Export context** in the app. The collection id can be its last 8 characters.

```bash
cortex context abcd1234 -o CONTEXT.md
cortex context abcd1234 | less
```

### `cortex logout`

Deletes the saved token (the URL stays).

## Configuration

`cortex login` saves `{ "baseUrl", "token" }` to:

| System | Path |
| --- | --- |
| Linux, macOS | `$XDG_CONFIG_HOME/cortex/config.json`, else `~/.config/cortex/config.json` |
| Windows | `%APPDATA%\cortex\config.json` |

On Linux and macOS the file is readable by its owner only (mode `0600`).

## Environment variables

| Variable | Effect |
| --- | --- |
| `CORTEX_TOKEN` | Used instead of the saved token, e.g. in CI. |
| `CORTEX_URL` | Used instead of the saved URL. |
| `NO_COLOR` | Turns colours off. They are also off when the output is not a terminal. |

## Errors

Errors go to stderr in red, with exit code 1. A `401` means the token is invalid or revoked: run
`cortex login` again. A `403` on `save` means the token is read-only or the plan is not Pro.

## Development

From `cli/`: `npm install`, then `npm run build` (one ESM file, `dist/cortex.js`) and
`npm run typecheck`. The build bakes in the production URL, the `PRODUCTION_URL` constant in
`tsup.config.ts` (`CORTEX_DEFAULT_URL` overrides it), and fails without one. The tests run with the
app's `npm test`, from the repo root.

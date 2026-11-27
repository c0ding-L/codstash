# Roadmap v2: after the MVP

Picked by the author on 2026-11-26, after a brainstorm, a second opinion from ChatGPT
(`ChetGPT-Cortex-2nd-Opinion.txt`, not tracked) and an advisor review. The groups run in the
order A → B → C → D, and E is for later. Each step gets its own spec in `context/features/` and
its own branch, following the usual workflow. Nothing here is implemented yet.

Cross-cutting costs, true for every step:
- Every new UI string goes in `en.json` and `fr.json`, with the French coming from DeepL and the
  `codstash-ui-en-fr` glossary.
- Schema changes go through `prisma migrate dev` on the Neon develop branch only.
- Server actions, route handlers and `src/lib` get unit tests; components get a browser check.

Positioning (for a later homepage copy pass): "a personal technical memory for developers".
Capture what you learn, remember what you solve, and give your AI coding assistants the context
they need.

---

## A. Close the MVP gaps

The pricing table promises "custom types, AI, export" to Pro. As of `24c06bb`, neither export
nor custom types exist. A1 and A2 come first, and the rest of A follows in small separate steps.

### A1. Export (Pro) — done 2026-11-26 (`47a1429`)
- `GET /api/export?format=json|zip` covers the signed-in user's data: items, collections, tags,
  custom types and links between them.
- JSON: one versioned document (`{ version: 1, exportedAt, items, collections, types }`).
- ZIP: the same JSON, a readable tree (`snippets/<title>.<ext>`, `notes/<title>.md`, ...) **and
  the R2 files**: a complete backup.
- Constraint for the spec: stream the ZIP without buffering it. That needs a zip library that
  streams on the Node runtime, and a check against Vercel's function duration and memory limits,
  so a stash full of images does not fail partway through. Read the route-handler streaming
  docs in `node_modules/next/dist/docs/` before choosing.
- Entry point: a Settings › Data section. Rate limited (Upstash).

### A2. Custom item types (Pro) — done 2026-11-26 (`089eb1f`)
- Create, rename and delete a type with a name, an icon (a curated lucide list) and a color (the
  existing tokens). The slug is derived from the name and unique per user (`@@unique([userId,
  slug])` exists already).
- Text-based at first (file / URL variants: decide in the spec).
- It shows in the sidebar and in New Item, and `/items/[slug]` works for it.
- Delete is refused while items still use the type (`onDelete: Restrict` exists already).
- After a Pro lapse the types stay readable, and only creating new ones is gated.

### A3. Context export (Free) — done 2026-11-26 (`91d5347`)
- An "Export as context" button on a collection produces a `context.md` with the collection's
  description and its items, ready to give to Claude Code, Cursor or Codex.
- Reuses A1's serialisation code, so it comes right after A1 without growing A1's scope.
- With a richer collection description (stack, conventions), this replaces a separate "Project"
  entity.

### A4. Import — done 2026-11-27 (`65815fa`)
- Re-import a JSON export (A1's round trip), with title conflicts resolved by "skip" or
  "duplicate".
- Loose files: `.md`/`.txt` become notes, and code files become snippets with the language
  taken from the extension (`code-language.ts`).
- GitHub Gist: list the **public** gists of the linked GitHub account (no extra OAuth scope),
  pick some, and import each file as a snippet. Secret gists would need the `gist` scope, so
  they are out.
- Counts against the Free limits (`usage-limits.ts`).

### A5. Recently used — done 2026-11-27 (`8530aab`)
- `Item.lastUsedAt DateTime?`, set when an item is copied or opened in the drawer, with a
  throttle so one session does not write each time.
- A "Recently used" section on the dashboard, and a sort option in the lists.

### A6. Secret detection
- A pure `src/lib/secrets.ts` matches known patterns: AWS keys, `ghp_…`/`github_pat_…`, `sk-…`,
  `-----BEGIN … PRIVATE KEY-----`, JWTs and `.env`-style `KEY=value` lines.
- **Warn and confirm, never block**, on save and before an AI call. Regexes catch fakes
  (`sk-xxx` in a tutorial), so blocking would break AI features Pro users paid for.
- **Hard block only for public sharing** (D1). For MCP (C3) a warning is enough, since the user
  connects their own assistant.
- To check in the spec: the data policy of the free OpenRouter model (whether it logs or keeps
  prompts). If it does, that is the main argument for the warning.
- Must ship before C3 and D1.

### A7. AI streaming
- A defect in a feature Pro users already pay for: answers take 5–90 s, and one Explain call
  timed out at 60 s.
- Move Explain, Description, Optimize and Tags to a route handler that streams the answer.
- Settle the open item from History: set `maxDuration`, and check that Fluid compute is on in
  the Vercel project.

---

## B. Variables in prompts and commands (Free)

- `{{name}}` and `{{name:default}}` in a prompt or command, plus the built-ins `{{date}}` and
  `{{uuid}}`. A pure parser goes in `src/lib` (tested).
- Copying an item that has variables opens a small form with one field per variable, and the
  filled text goes to the clipboard. Copy without the form stays possible.
- Last values remembered per item in `localStorage` (a per-device convenience).
- No schema change. No `{{clipboard}}` (it needs a browser permission) and no `{{cursor}}`
  (there is no editor).

---

## C. API, MCP server and CLI (read for Free, write for Pro)

### C1. Personal API tokens
- New model `ApiToken`: `name`, `prefix` (shown), `hash` (SHA-256, the token is shown once),
  `scopes` (`read` / `write`), `lastUsedAt`, `expiresAt?` and `revokedAt?`.
- Managed in Settings › API tokens (create, list and revoke).
- Bearer auth helper shared by C2 and C3, rate limited per token (Upstash).

### C2. REST API v1
- `/api/v1/items` (search, list, create), `/api/v1/items/[id]` (get, update) and
  `/api/v1/collections`.
- Reuses `src/lib/db/*` and the existing zod schemas, and the same Free limits.
- A short reference page in `docs/api.md`.

### C3. MCP server
- A Streamable HTTP endpoint (`/api/mcp`) authenticated with an API token.
- Tools: `search_items`, `get_item`, `create_item`, `list_collections` and
  `get_collection_context` (A3's output). Prompts with variables (B) can be exposed as MCP
  prompts.
- Library choice (official `@modelcontextprotocol/sdk` or a Next adapter) to check against
  Next 16 before the spec.

### C4. CLI `cod`
- Lives in `cli/` in this repo and is published to npm.
- `cod login` (pastes a token), `cod search`, `cod get <id>` (prints or copies it),
  `cod run <command>` (fills variables, shows the command and asks before it runs), and
  `cod save` (from stdin or a file).
- Built on the REST API (C2).

---

## D. Sharing and PWA

### D1. Public collections
- `Collection.shareId` (random, nullable). Sharing on means a read-only public page at
  `/s/[shareId]`, and sharing off kills the link.
- Text items only at first. Files and images are left out, or served through short presigned R2
  URLs (decide in the spec).
- Secret detection (A6) blocks sharing a collection that contains a detected secret.
- Free: how many shared collections is open (Pro: unlimited).

### D2. PWA (installable only)
- Manifest, icons and a minimal service worker (Next's PWA guide in
  `node_modules/next/dist/docs/`). No offline reading.

---

## E. Later

- **Error Vault:** a "Problem" type with a Markdown template (Error / Context / Cause /
  Solution), and search that accepts a pasted error message. **Built on A2** as a custom type,
  not an 8th system type, which would touch the seed, a production data migration, the sidebar
  and both catalogs. Matching by meaning needs semantic search.
- **Version history** on items, with an optional note on why something changed.
- **Semantic search** (pgvector on Neon), on condition that OpenRouter offers embeddings.
- **Browser extension** for capture, a thin client on C2.
- **Homepage copy** around the positioning above.

Not planned: a separate "Project" entity (covered by A3 and richer collections), a knowledge
graph, snippet testing (it needs an isolated sandbox, which Vercel cannot provide) and a
"knowledge health" status (A5's `lastUsedAt` covers "last used").

---

## Decisions

Settled by the author on 2026-11-26:
- Export ZIP **includes the R2 files**.
- API / MCP / CLI: **read for Free, write for Pro**.
- CLI in **`cli/` in this repo**, published to npm.
- PWA: **installable only**.

Defaults written into the specs, **all confirmed by the author on 2026-11-26**:

| # | Spec | Default |
| --- | --- | --- |
| 1 | A1 | Export (JSON and ZIP) is Pro only, as sold. |
| 2 | A2 | Custom types are text only, at most 20 per user. |
| 3 | A3 | Context file headings are in English. |
| 4 | A3 | Collection description cap raised from 2,000 to 10,000. |
| 5 | B | Variables only in prompts and commands. |
| 6 | C1 | A password change revokes all API tokens. |
| 7 | C2 | No DELETE in API v1. |
| 8 | C4 | Binary `cod`, package name chosen by the author. |
| 9 | C4 | CLI messages in English. |
| 10 | D1 | Free: 1 shared collection. |
| 11 | D1 | Shared pages `noindex` by default (toggle per collection). |
| 12 | D1 | Owner's name hidden by default (opt-in). |

## Specs

One per step, in `context/features/`:
- A: `export-spec.md`, `custom-types-spec.md`, `context-export-spec.md`, `import-spec.md`,
  `recently-used-spec.md`, `secret-detection-spec.md`, `ai-streaming-spec.md`
- B: `template-variables-spec.md`
- C: `api-tokens-spec.md`, `rest-api-spec.md`, `mcp-server-spec.md`, `cli-spec.md`
- D: `public-collections-spec.md`, `pwa-spec.md`

Cross-spec rules found in review:
- `shortId(id)` is the **last** 8 characters of a cuid, since the first ones are a shared
  timestamp (A1, C3, C4).
- The zod schemas move to `src/lib/item-schemas.ts` in A2, and A4 and C2 reuse them.
- Fluid compute and the duration cap are checked before A1 (the first `maxDuration` above 60).
- Request bodies stay under Vercel's ~4.5 MB limit: A4 imports in batches.

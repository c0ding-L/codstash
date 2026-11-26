# C2 — REST API v1

## Overview

A small JSON API under `/api/v1`, authenticated with C1's tokens, for the CLI (C4), scripts,
and later a browser extension. Reads for everyone, writes for Pro. It reuses the existing db
layer and validation. Roadmap: `docs/roadmap-v2.md` § C2.

## Requirements

### Shared validation

- The schemas live in `src/lib/item-schemas.ts`, moved there by A2. Use them unchanged.

### Endpoints (route handlers, `src/app/api/v1/...`)

Every route starts with `authenticateApi(request, "read" | "write")`.

| Method & path | Scope | Notes |
| --- | --- | --- |
| `GET /api/v1/me` | read | `{ id, name, email, isPro, proUntil, limits }`, used by `cod whoami` / `cod login`. |
| `GET /api/v1/items` | read | Query `q`, `type`, `tag`, `collection`, `idSuffix` (8 characters, for the CLI's short ids), `limit` (≤ 50, default 20), `cursor`. |
| `GET /api/v1/items/[id]` | read | Full item: content, url, language, tags, collections, type, file `{ name, size }` (no bytes). |
| `POST /api/v1/items` | write | Body = `createItemSchema` for text types and links (`file`/`image` give 422 `unsupported_type`). Free limits do not apply, since write is Pro. |
| `PATCH /api/v1/items/[id]` | write | Partial `updateItemSchema`. |
| `GET /api/v1/collections` | read | `id, name, description, itemCount`. |
| `GET /api/v1/collections/[id]/context` | read | A3's Markdown (`text/markdown`). |

- No `DELETE` in v1, so a leaked write token can add or edit but not wipe. (Default; confirm.)
- Custom types: once A2 has shipped, `type` accepts a custom slug.

### Search (`src/lib/db/api-items.ts`)

- `q`: case-insensitive `contains` on title, description and content, or an exact tag name
  (`OR`). Results ordered by `updatedAt desc, id desc`.
- Cursor pagination: an opaque base64url of `{ updatedAt, id }`. `nextCursor` is null at the
  end.
- List items return a preview (`content` cut to 300 characters plus a `truncated` flag). The
  full content comes from `GET /items/[id]`.
- No full-text index for now: per-user stashes are small (Free has 50 items). Note in the
  History whether the query plan (`EXPLAIN` on develop) is acceptable for 1,000 items.

### Responses

- `200` / `201` JSON with `{ data }`, or `{ data, nextCursor }` for lists.
- Errors as in C1: `{ error: { code, message } }`. `422` carries `details: [{ path, message }]`
  taken from zod.
  - **The schemas' messages are translation keys** (`errKey(...)`), so each message goes
    through `e.issue()`, never raw.
  - Force English: get the translator with an explicit `en` locale (`getTranslations({ locale:
    "en", namespace: "errors" })`). Otherwise `src/i18n/request.ts` follows the caller's
    `Accept-Language`.
  - Test that a 422 body holds no `errors.` key.
- Dates as ISO strings. No CORS headers: the clients are server-side or the CLI.

### Documentation

- `docs/api.md`: auth, each endpoint with a `curl` example, error codes and limits.
- Linked from Settings › API tokens.

## Testing

- `src/lib/item-schemas.test.ts`: the moved schemas behave the same (move the relevant existing
  cases).
- `src/lib/db/api-items.test.ts`: owner scope on every query, `q` builds the `OR`, cursor
  encode and decode, limit clamped.
- A route test per endpoint:
  - 401 and 403 scopes (auth mocked through `@/lib/api-auth`)
  - 404 for another user's item
  - 422 with details
  - 201 body
  - `file` type refused
  - PATCH partial
  - `context` content type
- Manual: the `curl` examples from `docs/api.md` against `next dev` with a real token on
  develop.

## Notes

- Versioned path (`v1`), so later changes do not break the CLI.

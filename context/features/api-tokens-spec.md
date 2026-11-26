# C1 — Personal API tokens

## Overview

Users create personal tokens to reach their stash from outside the browser: the REST API (C2),
the MCP server (C3) and the CLI (C4). A token is shown once, stored hashed, scoped `read` or
`read+write`, and can be revoked. **Read for Free, write for Pro** (author's decision). Roadmap:
`docs/roadmap-v2.md` § C1.

## Requirements

### Schema (migration `api_tokens`, develop only)

```prisma
model ApiToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  // First 12 characters of the token ("cstash_" + 5), shown in the list to tell tokens apart.
  prefix     String
  // SHA-256 of the whole token, hex. The token itself is never stored.
  hash       String    @unique
  // "read" or "write" (write implies read).
  scope      String
  lastUsedAt DateTime?
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

### Token format and checks (`src/lib/api-token.ts`, pure, server-only)

- `generateToken()`: `cstash_` + 32 random bytes in base64url (`crypto.randomBytes`), 50
  characters in all. It returns `{ token, prefix, hash }`.
- `hashToken(token)`: SHA-256 hex. A plain hash is right for 256-bit random tokens; bcrypt would
  add nothing.
- `parseBearer(header)`: the token when the header is `Bearer cstash_…` with the right length,
  otherwise null.

### Authenticating a request (`src/lib/api-auth.ts`)

`authenticateApi(request, need: "read" | "write")` returns `{ userId, tokenId, scope }` or a
`Response`:

1. No or malformed bearer: 401 `invalid_token`.
2. Look up by `hash`: missing, revoked or expired gives 401 `invalid_token`. All three answer
   the same, so the reason never leaks.
3. `need === "write"`:
   - A `read` token gives 403 `insufficient_scope`.
   - Then `getPlanStatus(userId)` must be Pro: 403 `pro_required` (a write token survives a Pro
     lapse but stops writing).
4. Rate limits, per token:
   - `api: { attempts: 120, window: "1 m" }`
   - `apiWrite: { attempts: 30, window: "1 m" }` on writes too
   - 429 with `Retry-After`
5. `lastUsedAt`: raw-SQL update throttled to once a minute (same pattern as A5), fire and
   forget.

Error body for every API route: `{ "error": { "code": "...", "message": "..." } }`. Messages
are **English** (an API has no UI language). Add `WWW-Authenticate: Bearer` on 401.

### Managing tokens (Settings › API tokens)

- New section `#api`. The list shows name, prefix…, scope, created, last used, expires, and a
  Revoke button. Revoked tokens are hidden.
- "New token" dialog:
  - name (1–50 characters)
  - scope (`read` / `read + write`; `write` is disabled with a Crown for Free)
  - expiry (30 days / 90 days / 1 year / never, default 90 days)
- Result view: the token is shown **once**, with a copy button and "You won't see it again."
- At most 10 active tokens per user.
- Actions in `src/actions/api-tokens.ts`: `createApiToken` and `revokeApiToken`.
  - Each: zod, auth, owner scope; Pro checked for the `write` scope.
  - Revoke sets `revokedAt`. Revoking another user's token or a missing one answers "not
    found".
- The section also links to the API docs (C2) and the MCP setup (C3). Those blocks appear
  once those steps ship.

### Security notes

- Account deletion cascades to the tokens.
- **Password change revokes all tokens.** Sessions are already ended by `passwordChangedAt`, so
  the same "I think I was compromised" action should cover tokens. (Default; confirm.)
- Never log a token. In errors and logs, use the token id only.
- Add the `cstash_` pattern (`\bcstash_[A-Za-z0-9_-]{43}\b`) to A6's `detectSecrets` in this
  feature. Users will paste their own token into a note holding their MCP config.
- Errors use English with an explicit `en` locale, never `Accept-Language` (see C2).

## Testing

- `src/lib/api-token.test.ts`: format and length, prefix, hash stable and hex, `parseBearer`
  cases (missing, wrong scheme, wrong prefix, wrong length).
- `src/lib/api-auth.test.ts`:
  - each 401 case gives the same body
  - a read token used for write
  - write on Free (lapsed)
  - rate limit 429 with `Retry-After`
  - `lastUsedAt` throttled
  - happy path
- `src/actions/api-tokens.test.ts`: auth, Free writing gives a refusal, the 10-token cap, the
  returned token matches the stored hash, revoke owner scope.
- `profile.test.ts`: a password change revokes the tokens.
- Browser: create, copy, list, revoke, all from Settings in FR and EN.

## Notes

- Strings in `settings.api` (EN/FR).

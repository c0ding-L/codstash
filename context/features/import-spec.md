# A4 — Import (Cortex JSON, loose files, GitHub Gists)

## Overview

Users bring knowledge in from three sources:
- a Cortex JSON export (A1's round trip)
- loose files (`.md`, `.txt` and code files)
- their public GitHub Gists

The spec lists "Import from files", and a newcomer with 300 gists needs a way in. Imported items
count against the Free limits. Roadmap: `docs/roadmap-v2.md` § A4.

## Requirements

### Shared import core (`src/lib/import.ts`, pure)

- `ImportCandidate = { title, type: "snippet" | "note" | "prompt" | "command" | "link" |
  { customSlug }, content?, url?, language?, description?, tags, collectionNames }`.
- `fromCortexExport(json)`:
  - Validate with zod: `format === "cortex-export"` and `version === 1`. Anything else gives an
    error.
  - Map the items. File and image items are **skipped** (their bytes are not in the JSON) and
    counted as `skipped: "file"`.
  - Custom-type items: if a type with that slug exists, or can be created (Pro, A2), use it.
    Otherwise import the item as a note with a `type:<slug>` tag.
- `fromLooseFile(name, text)`:
  - `.md` and `.txt` become a note.
  - A known code extension becomes a snippet, with the language from a new
    `languageForExtension(ext)` in `code-language.ts`.
  - `.sh`, `.ps1` and `.bat` become a command.
  - The title is the file name without its extension.
- `fromGist(gist)`: one candidate per file. The language comes from GitHub's `language` field
  mapped through `LANGUAGE_OPTIONS`, or from the extension. Markdown files become notes. Tag
  `gist`. Description is the gist's description.
- Caps: each `content` uses `ITEM_LIMITS` (100,000 characters). A longer one is skipped
  (`skipped: "tooLong"`).
- **Every candidate goes through the same zod schemas as `createItem`**
  (`src/lib/item-schemas.ts`, moved there by A2), including the link URL rule and the field
  caps.
  - A crafted export must not store what the form would refuse, such as a `javascript:` URL,
    which D1 would then serve publicly.
  - A candidate that fails validation is skipped (`skipped: "invalid"`), with its title in the
    report.

### Writing (`src/lib/db/import.ts`)

- `importCandidates(userId, candidates, { maxItems, conflict })`:
  - `conflict: "skip" | "duplicate"`: "skip" leaves out a candidate whose title and type
    already exist for the user.
  - Collections named in a JSON export are matched by name, and created if missing. Free users
    stay within the collection limit, and past it the links are dropped and reported.
  - Writes in chunks of 50 in a transaction, re-checking the Free limit under the lock
    (`assertBelowLimit`), like `createItem`. When the limit is hit, stop and report how many
    were left out.
  - Returns `{ created, skipped: { duplicate, file, tooLong, limit }, collectionsCreated }`.

### Route

- **Vercel caps a function's request body at about 4.5 MB**, so a large export cannot go up in
  one POST. The browser therefore does the reading:
  - It parses the Cortex JSON or the loose files itself, using the pure `src/lib/import.ts`,
    which is client-safe.
  - It sends **batches of candidates**: `POST /api/import` with JSON
    `{ candidates, conflict }`, up to 100 candidates and **under 3 MB** per request (the client
    measures the serialised size and splits).
  - The server validates each candidate again (above). It never trusts the client's mapping.
  - That also gives progress ("Imported 300 / 1,200").
- Route details:
  - Read the body with a size check (413 over 3.5 MB).
  - Rate limit `import: { attempts: 60, window: "1 h" }`, counted per batch.
  - `maxDuration = 120`.
- Note for the author (pre-existing, not part of this feature): `/api/upload` accepts 10 MB
  files through the function body (`UPLOAD_RULES.file.maxBytes`), which is above that Vercel
  limit. Check uploads over 4.5 MB on the deployed app.
- `POST /api/import/gists`, JSON:
  - `{ username?, gistIds: string[] }` imports the chosen ones.
  - `GET /api/import/gists?username=` lists them (id, description, file names, updated).

### GitHub Gists

- **Public gists only.** No new OAuth scope.
- Default username: the linked GitHub account's login.
  - Read it with `GET https://api.github.com/user` using the stored `Account.access_token`
    (provider `github`).
  - Without a linked account or token, the user types a username.
- Calls use the user's token when there is one (5,000 requests/h). Otherwise they are
  unauthenticated (60 requests/h per IP, shared on Vercel), and a 403 or 429 shows "GitHub rate
  limit, try later".
- Files: use `files[].content` from `GET /gists/{id}`. When `truncated` is true, fetch
  `raw_url`, **only if its host is `gist.githubusercontent.com`** (no SSRF through a crafted
  URL), with a 10 s timeout.
- At most 100 gists per import.

### UI (Settings › Data, below A1's export card)

- An "Import" card with three tabs:
  - **Cortex export**: a JSON file picker, a conflict choice (skip or duplicate), then Import.
  - **Files**: multi-select (drag and drop with the same `FileUpload` look), a preview list
    (title, detected type, language) where a type can be changed, then Import.
  - **GitHub Gists**: the username (pre-filled), a list with checkboxes, then Import.
- Result: a summary toast plus an inline report of the counts, with a link to the dashboard.
- Free users can import. The limits apply, and the dialog shows "N of 50 items used" before
  the import starts.

## Testing

- `src/lib/import.test.ts`:
  - export validation (wrong format or version)
  - mapping of each type, files skipped
  - custom slug fallback to a note with a tag
  - loose file detection by extension
  - gist mapping (language, markdown, tags)
  - too-long content skipped
- `src/lib/db/import.test.ts`: owner scope, conflict skip, chunking, the Free limit stop with
  counts, collection creation within limits.
- Route tests:
  - auth, 413, 429, an invalid candidate skipped (a `javascript:` URL), batch cap
  - gists: no token gives an unauthenticated call
  - a `raw_url` on another host is refused
  - GitHub 403 is turned into the friendly error (`fetch` mocked)
- Browser:
  - Export (A1) and re-import into a fresh develop account.
  - Import three loose files.
  - Import the author's public gists.

## Notes

- A ZIP import (with files) is out: later, if asked.
- Imported content is user input and is never translated.

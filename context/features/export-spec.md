# A1 — Export (JSON / ZIP)

## Overview

Pro users download all their data: a JSON document, or a ZIP holding the same JSON, a readable
tree of their text items **and their R2 files**. The pricing table already sells "export" with
Pro, so this closes an MVP gap. Roadmap: `docs/roadmap-v2.md` § A1.

## Requirements

### Prerequisite: Vercel duration (author's check, before any code)

- This is the first route with `maxDuration` above 60 (300 here; A4 and A7 use 120).
- Check in the Vercel project that **Fluid compute is on** and that the plan allows 300 s. A
  `maxDuration` above the plan's cap can fail the deploy, not only time out.
- If the cap is lower, use that value here and note it in the roadmap.

### Short ids (applies to every spec that shows a shortened id)

- Ids are Prisma `cuid()` (v1): `c` + timestamp + counter + fingerprint + random. **The first
  characters are the timestamp**, so items created in the same burst (seed, A4 imports) share
  them.
- Add `shortId(id)` to `src/lib/utils.ts`: the **last 8 characters** (the random part). Use it
  for `<id8>` below, and for the short ids in C3 and C4.
- Test it with real-shaped cuids created in the same millisecond.

### Route

- `GET /api/export?format=json|zip`, a route handler (`src/app/api/export/route.ts`).
  - `/api` is outside the proxy matcher, so check the session: 401 without one.
  - Pro only (`getPlanStatus` + a new `canExport(plan)` in `usage-limits.ts`): 403 otherwise.
  - New limit `export: { attempts: 5, window: "1 h" }` per user in `rate-limit.ts`: 429 with
    `tooManyAttemptsResponse`.
  - An unknown or missing `format`: 400.
  - Errors return the JSON error shape the other routes use, translated (`errors.export.*`).
- `export const maxDuration = 300` on the route (read
  `03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`).
- `Content-Disposition: attachment; filename="cortex-export-YYYY-MM-DD.json|zip"` and
  `Cache-Control: no-store`.

### Data (`src/lib/db/export.ts`, one owner-scoped read)

- Items: `id, title, description, type (slug), contentType, content, url, language, isFavorite,
  isPinned, tags (names), collectionIds, file ({ name, size }) or null, createdAt, updatedAt`.
- Collections: `id, name, description, isFavorite, createdAt, updatedAt`.
- Custom types (after A2): `slug, name, icon, color` and A2's fields. Before A2: `[]`.
- Read in pages of 500 items (`cursor` on `id`), so a large stash never sits in memory as one
  Prisma result. 1 MB of JSON per 500 items stays fine.

### JSON document (`src/lib/export.ts`, pure)

`{ format: "cortex-export", version: 1, exportedAt, user: { name, email, locale }, types,
collections, items }`. Dates are ISO strings. Import (A4) reads this shape back, so `version` is
mandatory.

- **Written incrementally, never built as one object:**
  - `exportJsonChunks(header, itemPages)` is an async generator. It yields the header up to
    `"items":[`, then one serialised item at a time with commas, then `]}`.
  - The JSON response and the ZIP's `data.json` both stream from it.
- Pure pieces that are tested: `exportHeader(...)` and `exportItem(row)`. Run the generator's
  output through `JSON.parse` in the test to prove it stays valid.
- `types` and `collections` are small (capped), so they go into the header whole.

### ZIP

- Entries:
  - `data.json`: the document above.
  - `items/<type>/<safe-title>-<id8>.<ext>`: one file per text item.
    - `.md` for notes, prompts and custom types.
    - The language's extension for snippets and commands, through a new
      `extensionForLanguage(language)` in `code-language.ts` (fallback `.txt`, and `.sh` for a
      command with no language).
  - `links.md`: every link as `- [title](url)`.
  - `files/<id8>-<fileName>`: the R2 objects (files and images).
- `safeFileName(title)` (pure, tested): strip `/ \ : * ? " < > |` and control characters,
  collapse spaces, cap at 80 characters, never empty (`untitled`). `<id8>` keeps names unique.
- **Streaming, never buffered.**
  - The response body is a `ReadableStream` built while it is sent.
  - The R2 objects are read one after the other with the existing `getObject(key)` (it returns a
    stream) and piped into the archive. Never `arrayBuffer()`.
- Library:
  - Pick one that writes a ZIP from an async iterable of web streams, on the Node runtime, with
    ZIP64 support. Candidate: `client-zip` (`downloadZip` / `makeZip`, no dependencies).
  - Check it with Context7 before installing, and install **through Windows npm**.
  - Do not use `jszip`: it builds the archive in memory.
- An R2 object that is missing does not fail the export. Skip it, and list it in a
  `missing-files.txt` entry written last. `data.json` is streamed before the files, so it
  cannot know which ones are missing.
- Memory and duration: one file in flight at a time. Before finishing, measure with the demo
  account plus about 50 MB of images on develop, and note the time.

### UI

- `/settings`: new section `#data` "Data" after the existing ones, with a card:
  - "Export as JSON" and "Export as ZIP (with files)": plain `<a href download>` links.
  - A note that the ZIP can be large and take a while.
- Free users see the card with a Crown and an "Upgrade" link instead of the buttons (same
  pattern as the other Pro upsells).
- Strings in `settings.data` (EN, FR via DeepL + glossary).

## Testing

- `src/lib/export.test.ts`: `exportJsonChunks` output parses and has the version,
  `exportItem` shape, `safeFileName` edge cases
  (empty, slashes, 300 characters, emoji), entry names unique for two items with the same
  title, `extensionForLanguage` (in `code-language.test.ts`).
- `src/lib/db/export.test.ts`: every query filters by `userId`.
- `src/app/api/export/route.test.ts`: 401, 403 Free, 429, 400 bad format, JSON headers and body,
  ZIP content type, and a missing R2 object skipped (with `@/lib/r2` mocked).
- Browser check:
  - Download both formats on the demo account set Pro on develop, then reset it to Free.
  - Open the ZIP and check that an image opens.

## Notes

- Free users keep no export, as sold. Open question for the author: JSON export for everyone, so
  nobody's data is ever locked in? (default: Pro only)
- A3 (context export) reuses `src/lib/export.ts`'s per-type rendering. Keep the
  `renderItemText(item)` helper that turns an item into its file body separate, so A3 can import
  it.

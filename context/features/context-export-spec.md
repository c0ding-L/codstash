# A3 — Context export (Free)

## Overview

Every user can turn a collection into one Markdown file for an AI coding assistant (Claude
Code, Cursor, Codex, ChatGPT): its description, then its items, rendered by type. This is the
"Context Packs" idea without a new entity: a collection with a rich description (stack,
conventions) **is** the pack. Roadmap: `docs/roadmap-v2.md` § A3. Comes after A1, whose
`renderItemText` it reuses.

## Requirements

### Rendering (`src/lib/context-export.ts`, pure)

`renderCollectionContext({ collection, items, exportedAt })` returns a string:

```
# <collection name>

<collection description, as written>

_Exported from Cortex on <ISO date>. <N> items._

## Snippets
### <title>
<description, if any>
```<language>
<content>
```
## Commands      (fenced, language or `bash`)
## Prompts       (fenced as ```text, so its Markdown stays literal)
## Notes         (raw Markdown, its headings shifted down by two levels)
## <custom type> (as notes, after A2)
## Links         (- [title](url): description)
## Files         (- fileName (size): names only, no content)
```

- Empty sections are left out. The section order is fixed (above), and items inside a section
  are sorted by `updatedAt` descending.
- Fences: when the content itself contains a ``` fence, use a longer fence (````) so the file
  stays valid. Write a pure helper for it and test it.
- Section headings are **English**, whatever the UI language. The file is for an AI, and the
  user's content is not translated anyway. (Default; tell the author.)
- Total cap of 400,000 characters. Past that, stop at an item boundary and add a
  `_Truncated: N more items not included._` line.

### Delivery

- `GET /api/collections/[id]/context`, a route handler:
  - 401 without a session, 404 if the collection is missing or not the user's own.
  - `text/markdown; charset=utf-8`, `Content-Disposition: attachment;
    filename="<safe-name>-context.md"` (`safeFileName` from A1), `no-store`.
- Rate limit `contextExport: { attempts: 30, window: "1 h" }` per user.
- Free and Pro alike. File items list only names, so Free users get nothing Pro-only.

### UI

- `CollectionHeaderActions` (`/collections/[id]`) gets an "Export as context" menu entry
  (`FileDown` icon) that downloads the file.
- It also gets a "Copy as context" entry that fetches the same route and copies the text with
  `copyFromPromise`. If the text is over 200,000 characters, it shows a toast suggesting the
  download instead and copies nothing.
- The collection form's description gets a hint: "Describe the stack, conventions and goals:
  they lead your exported context." The description cap stays 2,000 (`src/actions/collections.ts`).
  Open question for the author: raise it to 10,000 so it can carry real conventions?
  (Default: raise to 10,000, in the same action schema.)

## Testing

- `src/lib/context-export.test.ts`:
  - section order and empty sections left out
  - fence lengthening when the content holds ```
  - note headings shifted down
  - cap and truncation line
  - links and files formatted
  - the description and the user's text left untouched (never translated)
- Route test: 401, 404 for another user's collection, headers, 429.
- Browser:
  - Download from a collection with a snippet, a command, a prompt, a note and a link, then
    open the file.
  - Copy from the menu.

## Notes

- After A6 (secret detection), add a warning before download or copy when an item matches. No
  block: the user is giving it to their own assistant.
- C3 (MCP) exposes the same rendering as the `get_collection_context` tool.

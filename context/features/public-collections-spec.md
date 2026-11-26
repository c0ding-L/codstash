# D1 — Public collections

## Overview

A user can share a collection as a read-only public page: a cheat sheet, a set of prompts, a
small developer portfolio. Anyone with the link sees it without an account, and a footer brings
visitors to Cortex. Sharing is refused while the collection holds a likely secret (A6). Roadmap:
`docs/roadmap-v2.md` § D1.

Defaults to confirm:
- Free: 1 shared collection. Pro: unlimited.
- `noindex` by default, with an "Allow search engines" toggle per collection.

## Requirements

### Schema (migration `collection_sharing`, develop only)

- `Collection.shareId String? @unique`: 22 random base64url characters (`crypto.randomBytes(16)`).
  Null means not shared.
- `Collection.sharedAt DateTime?`, `Collection.shareIndexable Boolean @default(false)` and
  `Collection.shareShowOwner Boolean @default(false)`.

### Actions (`src/actions/collections.ts`)

- `setCollectionSharing(id, { shared, indexable? })`, with zod, auth and owner scope.
  - **Turning it on:**
    - Check the Free cap: count `shareId not null` for the user against `FREE_LIMITS.shared = 1`.
    - **Scan every text item of the collection with `containsSecrets`.** If any matches, refuse
      with the item titles (at most 5, then "and N more").
    - Otherwise set a new `shareId` and `sharedAt`. A collection that was already shared keeps
      its id.
  - **Turning it off** sets `shareId` to null, so the old link dies at once.
  - "Reset link": a new `shareId`.
- Returns `{ shareId, url }`.

### Public page `/s/[shareId]`

- Outside the proxy matcher (it is public). Dynamic, rendered per request like the other pages
  (`await connection()`).
- Query `getSharedCollection(shareId)`: the collection's name and description, and its **text
  items and links**.
  - The owner's display name is shown **only if the owner opts in**, with a "Show my name"
    toggle in the share dialog, off by default. GitHub OAuth names are often real names. The
    email is never shown.
  - Links are rendered only when the URL passes the existing web-URL check (`isWebUrl` in
    `src/lib/utils.ts`, used by `link-url.ts`). Anything else is shown as plain text, never as a
    link.
  - The items are:
  - title, description, type, content, language, url, tags, `updatedAt`
  - File and image items are left out in v1.
- **Render-time filter:** items for which `containsSecrets(item)` is true are not shown. That
  covers an item that gained a secret after sharing. The owner learns about it through the
  notice in the share dialog (below).
- Layout:
  - The `HomeNav`-style top bar, then the collection name and description (Markdown, no raw
    HTML).
  - Items grouped by type and rendered read-only: code with the existing highlighter (shiki),
    Markdown for notes and prompts, links with their logo.
  - A copy button on each item. It is a copy only, with no `markUsed`, since the visitor is not
    the owner.
  - Footer: "Shared with Cortex: build your own technical memory", linking to `/register`.
- Metadata:
  - The title is `<collection name> · Cortex`, the description the first 160 characters of the
    description.
  - `robots: { index: shareIndexable, follow: shareIndexable }`.
  - An OG image is out of scope.
- 404 for an unknown or revoked `shareId`, the same for both.
- Page chrome in the visitor's language (the existing locale resolution). The content stays as
  written.

### UI (owner side)

- `CollectionHeaderActions` gets a "Share" entry that opens `ShareCollectionDialog`:
  - a switch, the link with a copy button, "Reset link"
  - the indexable toggle
  - Free: "1 of 1 shared collection" when used, with an upgrade link
  - The secret-block error lists the items.
  - If some items are currently hidden by the render-time filter, it shows "N items are hidden
    because they look like secrets".
- The collection card and header show a small `Globe` badge when the collection is shared.

## Testing

- Action tests:
  - auth and owner scope
  - Free cap
  - refused when an item holds a fake token, with titles listed
  - on, then off (`shareId` null), then reset (a new id)
  - indexable flag
- `src/lib/db/collections.test.ts`: `getSharedCollection` selects no email and no file items,
  and filters by `shareId`.
- A pure helper `visibleSharedItems(items)` that drops secret-looking items (in
  `src/lib/share.ts`), tested.
- Browser:
  - Share a collection and open the link in a private window: no session, it renders, copy
    works.
  - Unshare: 404.
  - Add a fake secret to a shared collection: the item is hidden, and the dialog says so.
  - Check `noindex` in the HTML.
  - Check in FR and EN.

## Notes

- Strings in `share.*` and `publicCollection.*` (EN/FR).
- Abuse (spam pages): out of scope for v1. Revoking stays possible at the database level.

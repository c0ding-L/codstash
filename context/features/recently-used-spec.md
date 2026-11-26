# A5 — Recently used

## Overview

The spec lists "Recently used". Items get a `lastUsedAt`, set when they are copied or opened,
and the dashboard shows a "Recently used" section. Roadmap: `docs/roadmap-v2.md` § A5.

## Requirements

### Schema (migration `item_last_used`, develop only)

- `Item.lastUsedAt DateTime?` with `@@index([userId, lastUsedAt])`.

### Recording a use, without touching `updatedAt`

- **`updatedAt` must not change.** It drives "Recent items" and the list order, and Prisma's
  `@updatedAt` is set on every `update` / `updateMany`.
- Write with raw SQL in `src/lib/db/items.ts`:
  `markItemUsed(userId, id)` runs
  `UPDATE "Item" SET "lastUsedAt" = now() WHERE id = $1 AND "userId" = $2 AND ("lastUsedAt" IS
  NULL OR "lastUsedAt" < now() - interval '5 minutes')`.
  - This is the throttle: at most one write per item every 5 minutes, with no read first.
  - Use `$executeRaw` with a tagged template, never string concatenation.
- Route handler `POST /api/items/[id]/used`:
  - 204 on success, including when the throttle skipped the write. 401 without a session.
  - Not a server action, because actions run one at a time per client and would hold up
    Favorite and Pin in the drawer.
- Client helper `markUsed(itemId)` in `src/lib/item-usage.ts`: `fetch(url, { method: "POST",
  keepalive: true })`, fire and forget, errors ignored.

### When an item counts as used

- Its content, command or URL is copied from any copy button that copies a whole item:
  - `ItemCopyButton`
  - `CommandCopyButton`
  - `LinkCopyButton`
  - the copy in `ItemActionBar`
  - the drawer's `CodeEditor` / `MarkdownEditor` copy, read view only
- Its file is downloaded.
- The drawer opens on it (`ItemDrawerProvider`, once per opening).

### Dashboard

- New section "Recently used" (`History` icon) above "Recent items".
  - Up to 6 items, ordered by `lastUsedAt` descending, through `getRecentlyUsedItems(userId,
    limit)`, which returns `DashboardItem` rows.
  - Hidden when no item has been used yet.
- No sort option in the lists for now (the roadmap mentioned one, but it is left out to keep the
  scope small).
- Command palette: with an empty query, the first group is "Recently used" (5 items).
  `/api/search` returns `lastUsedAt` with each item, and the palette sorts on it.

## Testing

- `src/lib/db/items.test.ts`: `markItemUsed` sends the raw query with the owner filter (check
  the `$executeRaw` mock's arguments). `getRecentlyUsedItems` filters on `lastUsedAt not null`
  and owner, ordered, limited.
- `src/app/api/items/[id]/used/route.test.ts`: 401, 204, and the query called with the session
  user.
- Browser:
  - Copy a command, then reload the dashboard: it appears in Recently used, and "Recent items"
    order is unchanged.
  - Open an item in the drawer twice within a minute: one write only.

## Notes

- Section title in `dashboard.recentlyUsed` (EN/FR).

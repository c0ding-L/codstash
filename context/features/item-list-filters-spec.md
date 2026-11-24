# Item List Filters Spec

## Overview

Add a toolbar above every type's item list to search, filter and sort that list. Reference: the
toolbars in `lovable-result/*.png`.

## Requirements

- A toolbar under the page title, on every `/items/[type]` page, with three parts:
  - **Search**: a field whose placeholder fits the type ("Search commands…", "Search file
    names…"). The `/` key focuses it when no other field has focus
  - **Filters**: All, Pinned (with its count), Favorites (with its count), then one chip per
    collection that holds items of this type
  - **Sort**: Recent (by last update, the default) and A–Z (by title)
- Search matches the title, the description, the content and the tags, case-insensitively.
  For files and images it also matches the file name; for links, the URL
- Filters and sort combine with the search. The "N of M" count reflects the filtered list
- The state lives in the URL (`?q=docker&filter=favorites&sort=az`), so a filtered list can be
  reloaded and shared
- When nothing matches: "No commands match "docker"." with a button to clear the search and
  filters
- On a phone, the search takes the full width and the filters scroll sideways

## Notes

- **Filter on the server.** The list is capped at `MAX_ITEM_LIMIT`, so filtering in the browser
  would miss items past the cap. The page reads the URL parameters and passes them to
  `getItemsByType` in `src/lib/db/items.ts`.
- Searching `content` with `contains` and `mode: "insensitive"` is a sequential scan. Fine at
  current sizes; full-text search with an index can come later.
- The search field updates the URL as you type, debounced.
- This is the per-type list search. The top bar's global search ("Search collections and
  items…", still display-only) is a separate feature.
- Unit tests for the query building in `src/lib/db/items.ts` (filters, sort, search fields).
- Independent of the per-type list specs: it can ship before or after them.

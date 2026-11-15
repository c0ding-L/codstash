# Link List Spec

## Overview

Show `/items/links` as a list led by where each link goes, with a button that opens it directly.
Reference: `lovable-result/links-list.png`.

## Requirements

- One row per link, three parts:
  - Left: a square tile with the domain's first letter, then the domain (`docs.github.com`) in
    Geist Mono, with the path (`/en/actions/…`) muted and truncated under it
  - Middle: the title, with the description under it
  - Right: an "Open ↗" button that opens the URL in a new tab (`rel="noopener noreferrer"`)
- Clicking anywhere else on the row opens the item drawer
- Pin/favorite marks next to the title
- On a phone, the domain moves above the title and the path is hidden
- Every other type is unchanged

## Notes

- Needs `url` in the list (not in `DashboardItem` today).
- Domain and path come from parsing the URL; a URL that doesn't parse shows as-is. Put the
  parsing in `src/lib/` with a unit test.
- No favicons: fetching them from a third-party service would send every saved domain to it.
- Only `http:` and `https:` URLs get the Open button.

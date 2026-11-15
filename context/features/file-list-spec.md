# File List Spec

## Overview

Show `/items/files` as a file table, like a file explorer. Reference:
`lovable-result/files-list.png`.

## Requirements

- A table with four columns: Name, Kind, Size, Updated
- Name: a small document icon showing the extension (`PDF`, `JSON`, `MD`, `YAML`…), the file
  name in Geist Mono, the pin/favorite marks, and the item's description on a second line
- Kind: a plain-language name for each allowed extension ("PDF document", "JSON",
  "Markdown", "YAML", "CSV spreadsheet", "Plain text"…). The mock's `.env.example` cannot be
  uploaded: `.env` is not in the allowlist
- Size: right-aligned, tabular numbers, with a thin bar showing the size relative to the
  largest file in the list
- Updated: the relative time
- Clicking a row opens the item drawer
- On a phone, Kind and the size bar are hidden; Name, Size and Updated stay
- Every other type is unchanged

## Notes

- Needs `fileName` in the list (not in `DashboardItem` today); `fileSize` is already there.
- The extension-to-kind mapping can live next to the upload allowlist in `src/lib/files.ts`,
  which already knows every allowed extension. A unit test covers it.
- The demo account has no files yet: upload a few through the New Item dialog to check it.

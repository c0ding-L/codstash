# Snippet List Spec

## Overview

Show `/items/snippets` with each snippet's code next to its details, so a snippet is recognised
by its code. Reference: `lovable-result/snippets-list.png`.

## Requirements

- One row per snippet, two columns:
  - Left (about a quarter of the width): the title in Geist Mono, the pin/favorite marks, the
    description, the tags (`#react #hooks`), then a muted line with the language (in the type's
    colour), the line count, the collection and the relative time
  - Right: the first 7 lines of the code with line numbers and syntax highlighting, the last
    line fading out
- A "Copy" button in the code's top-right corner, visible on hover and on keyboard focus;
  copies the full snippet
- Clicking the row opens the item drawer
- On a phone, the details stack above the code
- Every other type is unchanged

## Notes

- Needs a code preview, the language, the line count and the tags in the list. None is in
  `DashboardItem` today.
  - The preview is the first lines, cut on the server; the line count is computed there from the
    full content.
  - Tags: load them for the whole list in one query, not per item.
- **Highlighting.** Monaco is too heavy to mount once per row. Use a highlighter that runs on
  the server and sends plain coloured HTML (e.g. Shiki), with colours matching the Monaco theme
  in `CodeEditor.tsx`. This adds a dependency: confirm it before starting.
- Language names go through `src/lib/code-language.ts`, as the editor's do.
- Copying needs the full code: fetch it on click from `/api/items/[id]`.

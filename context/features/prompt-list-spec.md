# Prompt List Spec

## Overview

Show `/items/prompts` as a reading list: the prompt's own text first, ready to copy. Reference:
`lovable-result/prompts-list.png`.

## Requirements

- A single full-width column, one prompt per entry, separated by space rather than card borders
- Each entry:
  - The title, with the pin/favorite marks
  - The prompt's text as a quote: a thin amber rule on the left, up to 3 lines, then truncated
  - A metadata line, muted and small: the tags (`#review`), the word count, an approximate token
    count (`~49 tokens`) and the relative time
  - A "Copy prompt" button, visible on hover and on keyboard focus; copies the full prompt
- Clicking the entry opens the item drawer
- Every other type is unchanged

## Notes

- Needs a text preview, the word count and the tags in the list. None is in `DashboardItem`
  today.
  - The preview is cut on the server (a few hundred characters, Markdown stripped to plain text),
    never the full content.
  - The word count is computed on the server from the full content, so the client never gets it.
  - The token count is an estimate (about 4 characters per token); label it with `~`.
  - Tags: load them for the whole list in one query, not per item.
- The Markdown stripping and the counts are utilities in `src/lib/` with unit tests.
- Copying needs the full text: fetch it on click from `/api/items/[id]`.
- The mock's row numbers (`01`, `02`) are left out: prompts are not a sequence.

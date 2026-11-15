# Command List Spec

## Overview

Show `/items/commands` as a terminal: every command readable and copyable from the list, without
opening the drawer. Reference: `lovable-result/commands-list.png`.

## Requirements

- One terminal-style frame around the whole list: a header bar with three window dots and the
  path `~/codstash/commands`, then one row per command
- Each row: the title as a shell comment (`# Prune Docker disk usage`), and under it the command
  itself after a `$` prompt, in Geist Mono
- Light shell colouring: the program name, flags (`-af`, `--volumes`), pipes and `&&`. No full
  highlighter needed
- On the right of each row, muted: the collection (when there is one) and the relative time;
  the favorite star when set
- A copy button on each row, visible on hover and on keyboard focus; copies the full command
- Clicking the row still opens the item drawer
- A multi-line command shows its first line, with a muted `…` marking the rest
- Every other type is unchanged

## Notes

- Needs the command text in the list. `DashboardItem` has no `content` today: add a short,
  server-truncated preview (first line, capped length), not the full content, since every
  card's item is passed to a client component (`ItemDrawerTrigger`).
- Copying must copy the full command, not the preview: fetch it on click from
  `/api/items/[id]` or carry the full text for commands only (commands are short). Decide in
  the plan.
- `DashboardItem` is shared with the dashboard reads; adding a field there affects them too.
- The `c copies the focused line` hint in the mock implies keyboard navigation between rows.
  Not required; leave it out unless asked.

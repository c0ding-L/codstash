# B — Variables in prompts and commands (Free)

## Overview

A prompt or command can hold variables, `{{name}}` or `{{name:default}}`. When an item with
variables is copied, a small form opens, its fields are filled in, and the filled text is
copied. Built-ins: `{{date}}` and `{{uuid}}`. No schema change. Roadmap:
`docs/roadmap-v2.md` § B. The CLI (`cod run`, C4) and MCP prompts (C3) reuse the parser.

## Requirements

### Parser (`src/lib/template-vars.ts`, pure, no imports from Next or React)

- Syntax: `{{ name }}` or `{{ name:default text }}`.
  - `name` matches `[a-zA-Z_][a-zA-Z0-9_-]{0,39}`.
  - The default is any text without `}`, trimmed.
- **Not variables**, so existing content never breaks:
  - `${{ … }}` (GitHub Actions)
  - names with a dot or a space (`{{ secrets.X }}`, `{{ .Values }}`, Jinja and Handlebars
    paths)
  - `\{{name}}`: escaped, rendered as a literal `{{name}}`
- `parseVariables(text)` returns `Variable[]` (unique by name, in first-seen order, `{ name,
  default?, builtin? }`).
  - The first default given for a name wins.
  - `date` and `uuid` are built-ins: they get no field unless the text gives a default.
- `fillVariables(text, values, { now, uuid })` returns a string.
  - It replaces each occurrence and removes the escaping backslash.
  - A missing value falls back to the default, then to an empty string.
  - `date` is `YYYY-MM-DD` in local time. `uuid` is one value per variable name (two
    `{{uuid}}` give the same id).
  - `now` and `uuid` are injected for tests.
- Only **prompts and commands** are templated. Snippets, notes and custom types never are,
  since `{{ }}` is common in code. (Default; confirm with the author. Custom types could opt in
  later.)

### Copy flow

- Hook `useTemplateCopy()` returns `copyItemText(text, { itemId, type })`:
  - Not a prompt or command, or no variables: copy as today (A5's `markUsed` included).
  - Otherwise: open `FillVariablesDialog`.
- `FillVariablesDialog`:
  - One input per variable (label = name, placeholder = default).
  - A live preview of the filled text, in a monospace block, scrollable, read-only.
  - "Copy" (Enter) and "Copy raw" (unfilled). Esc cancels.
  - The first field is focused.
- Last values are remembered per item and variable in `localStorage`
  (`cortex:vars:<itemId>`, at most 50 items, with the oldest dropped), wrapped in try/catch.
  This is a per-device convenience.
- Wire it into every copy button that copies a whole prompt or command:
  - `ItemCopyButton`, `CommandCopyButton`, `ItemActionBar`
  - the drawer's `CodeEditor` (command) and `MarkdownEditor` (prompt) read-view copy
  - The editors' copy **in edit mode** stays raw.
- Visual cue: in the drawer read view, variables are highlighted (a tinted inline span) in
  prompts (Markdown view). Commands in Monaco are not highlighted (later). The prompt list cards
  show a small `{{ }}` badge with the variable count.

## Testing

- `src/lib/template-vars.test.ts`:
  - simple, default, repeated name (first default wins)
  - `${{ }}` and dotted names ignored, escaping
  - built-ins with injected `now` and `uuid`, the same uuid for a repeated name
  - an unclosed `{{`
  - names over 40 characters ignored
  - unicode in defaults
  - fill with missing values
  - performance on 100,000 characters
- Browser:
  - A command `docker exec -it {{container}} psql -U {{user:postgres}}`: the dialog, the
    preview, Copy gives the filled text, "Copy raw", and values remembered after a reload.
  - A prompt with `{{date}}`: no field, the date filled.

## Notes

- Strings in `variables.*` (EN/FR). Variable names and defaults are user input, never
  translated.

# Fill from a file (New item dialog)

## Overview

In the New item dialog, a "Fill from a file" button reads one local text file and fills the
form: title, content and, where the type has one, language. The user reviews, edits and creates
the item as usual. Nothing is uploaded: the file is read in the browser, and the item is saved
through the existing `createItem` action.

It complements A4 Import (Settings › Data), which stays the place for bulk imports. The dialog
also gets a link to it.

Free and Pro: it creates one item through `createItem`, so the usual limits apply.

## Requirements

### Where it shows

- Only for types with a content field: Snippet, Command, Prompt, Note (`hasContentField`), and
  custom types.
- Never for File and Image. Their drop zone (`FileUpload`, `NewItemDialog.tsx:274`) uploads a
  file to R2, which is a different action. The new control must not look like that drop zone.
- A button next to the Content field's label: "Fill from a file" (`FileUp` icon), opening the
  system file picker. **No new drop zone.**

### What it fills

- **The type chosen in the dialog is kept.** Dropping `deploy.sh` into a Snippet form fills a
  snippet. The detected type is not applied: changing the type under the user is surprising,
  and the type picker is right there.
- Title: the file name without its extension (A4's `titleOf` rule). Filled only when the title
  is empty.
- Content: the file's text.
- Language (Snippet, Command, custom types): from the extension through `languageForExtension`
  (A4). An unknown extension leaves the current language as it is.
- Description, tags and collections are left as they are.

### Content already typed

- An empty content, or one equal to the custom type's template, is replaced without asking.
- Otherwise a confirm dialog asks first: "Replace the content with this file?" (Replace /
  Cancel). Cancel leaves the form untouched.

### Checks (browser only)

- Accepted extensions: those of A4 (`isImportableFileName`). Another file shows a toast and
  fills nothing.
- Over 100,000 characters (`ITEM_LIMITS.content`): a toast, nothing filled. A file over
  400,000 bytes is refused without reading it, as in A4's Files tab.
- A file that cannot be read as text: a toast.
- The form's own validation still runs on submit.

### Helper

- A pure `fileToFormFill(name, text, type)` in `src/lib/import.ts` (or a new
  `src/lib/fill-from-file.ts` if `import.ts` grows too large) returns
  `{ title, content, language? }` or `{ error: "unsupported" | "tooLong" }`. It reuses
  `detectFileType` and `languageForExtension`, and returns no language for a type without one.

### Link to bulk import

- Under the type picker, or at the dialog's foot: "Import several items…", linking to
  `/settings#data`. The dialog closes on click.

## Testing

- `fileToFormFill` (unit, next to the helper):
  - title from the name, with folders and extensions removed
  - language kept for Snippet, Command and custom types; none for Note and Prompt
  - unknown extension gives no language
  - unsupported extension and too-long content give the error
- Components are not tested (project rule). Browser checks:
  - fill a Snippet from a `.ts` file
  - fill a Note from a `.md` file
  - confirm and cancel when content is already typed
  - a custom type whose content is its untouched template
  - a refused `.png`
  - the link to Settings › Data
  - FR at 375 px

## Notes

- To check before implementing: what the code editor (Monaco) and the Markdown editor already
  do when a file is dropped on them. If either inserts the file's text, leave it. This spec
  does not add a drop target on the editors.
- The edit drawer is out of scope: filling an existing item from a file replaces its content,
  which is a different decision.
- UI strings in `en.json` and `fr.json`, French from DeepL. The file's text is user content and
  is never translated.
- Depends on A4 (`detectFileType`, `languageForExtension`, `isImportableFileName`). Start it on
  its own branch once A4 is merged.

# AI summaries of long notes and files

## Overview

The landing page promises "AI summaries of long notes and files", but no such feature exists: the
description generator writes one or two sentences from the first 3,000 characters, and file items
have no text content for it to read. This adds a **Summarize** action to the item drawer that
streams a short Markdown summary of a long note, prompt or text file, the way Explain does for
code (A7). It comes before the landing page update (`landing-update-spec.md`), so the page's claim
becomes true.

Decided by the author on 2026-11-27:

- The summary is **shown in the drawer, streamed, and not saved**.
- **Text files only**: `.txt`, `.md`, `.json`, `.yaml`/`.yml`, `.xml`, `.csv`, `.toml`, `.ini`, read
  from R2. No PDF or image: no new dependency, no vision model.
- The action shows **only for long items**, above a threshold. Below it, the description is
  enough.

## Requirements

### Which items

- Notes and prompts whose `content` is at least `SUMMARY_MIN_CHARS` long (1,500 characters).
- File items whose extension is one of the text kinds above and whose stored size is at least
  `SUMMARY_MIN_CHARS` bytes.
- Not snippets or commands (Explain covers code), not links, images or PDFs, not custom types (v1).
- One pure helper decides it, used by the drawer and the route: `canSummarize({ slug, content,
  fileName, fileSize })` in `src/lib`.

### Route `POST /api/ai/summarize`

- Same shape as `src/app/api/ai/explain/route.ts`: `aiItemSchema` body (`{ itemId }`), session
  check, the item read by owner, `canSummarize` checked **before** `aiGate` (a refused request
  spends no limiter slot), then `aiGate` (Pro, `ai` rate limit), then `completeStream` and
  `aiStreamResponse`. `maxDuration = 120`.
- Text: the note's or prompt's `content`, or the file read from R2 with `getObject`, decoded as
  UTF-8. Read at most `SUMMARY_CONTENT_LIMIT` (12,000 characters) and stop the stream there; the
  prompt says when the text was cut (`TRUNCATED_MARKER`).
- A file missing from R2 is a 404 with its own message; a file that is not valid UTF-8 is a 400.
- Errors: same codes and English/French messages as Explain (`ai.*` keys), plus
  `ai.summarizeFailed`, `ai.cannotSummarize` and `ai.fileUnreadable`.

### Prompt (`src/lib/ai-prompts.ts`)

- `summaryMessages({ title, kind, text, truncated, locale })`: a short Markdown summary, a lead
  sentence then at most 5 bullets, in the UI language (`FRENCH_ANSWER_INSTRUCTION`), code and
  identifiers unchanged. The text stays inside `<content>` delimiters it cannot close, treated as
  data, not instructions.
- `SUMMARY_MAX_TOKENS` (about 1,000) and an output cap like `EXPLANATION_MAX_LENGTH`.

### Drawer

- A **Summarize** button (Sparkles icon, Pro only, behind the same `aiAllowed` promise and
  Suspense as Explain) on notes, prompts and text files that pass `canSummarize`.
- The answer streams into a panel under the content, rendered as Markdown, with Copy and Close,
  reusing Explain's stream client and panel components (`ai-stream-client.ts`).
- Before the call, the secret check (`useSecretCheck`, A6) runs on the note's or prompt's content,
  as for the other AI actions. For a file, whose text the browser does not have, the server runs
  `detectSecrets` on what it read and adds the warning line to the start of the stream. The call
  is not blocked.

### Copy

- `ai.summarize` (button), `ai.summary` (panel title), and the error keys above, in `en.json`;
  `fr.json` through DeepL with the glossary, never by hand.

## Testing

- `src/lib/*.test.ts`: `canSummarize` (each type, the threshold, each file extension, PDF and
  images refused), `summaryMessages` (delimiters, truncation note, French instruction).
- `src/app/api/ai/summarize/route.test.ts` (mock `@/auth`, `@/lib/prisma`, `@/lib/r2`, the AI
  client): 401, 404, a short note refused before the gate, Free refused, a note streamed, a text
  file read from R2 and cut at the limit, a missing R2 object, invalid UTF-8.
- Browser (Playwright): a long note and a long `.md` file summarized on the demo account set Pro
  on develop (back to Free afterwards); the button absent on a short note, a snippet and a PDF; in
  English and French.
- `npm test`, `npm run build`, `npm run lint`.

## Out of scope

- Saving the summary (as the description or elsewhere).
- PDFs and images.
- Summaries of collections or of several items at once.
- Custom item types.

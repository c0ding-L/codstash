# A7 — AI streaming and timeouts

## Overview

On the free model, Explain and Optimize take 5–90 s, and one Explain call timed out at 60 s.
Pro users pay for these features. They also run as server actions, which block the drawer's
other actions (Favorite, Pin, Save) while they wait. Move **Explain** and **Optimize** to route
handlers that stream the answer, and set the timeouts properly. Tags and Description stay
server actions (short answers) and only get `maxDuration`. Roadmap: `docs/roadmap-v2.md` § A7.

## Requirements

### Streaming client (`src/lib/ai-client.ts`)

- Add `completeStream(messages, { maxTokens, timeoutMs, signal })`. It returns a
  `ReadableStream<string>` of text deltas.
  - It sends `stream: true` through the same adapters, and the adapters' `body()` takes a
    `stream` flag.
  - It parses Server-Sent Events: `data: {json}` lines, `choices[0].delta.content`,
    `data: [DONE]`, and `:` comment lines (OpenRouter sends `: OPENROUTER PROCESSING` keep-alives).
  - Write the parsing as a pure `parseSseChunk(buffer)` that returns `{ events, rest }`, so a
    line split across chunks still works.
- Errors:
  - A non-2xx answer, or an error event before any text, throws `AiProviderError` with the same
    codes as `complete()`, so `aiErrorMessage` keeps working.
  - An error after text has started ends the stream with an error the route turns into a
    marker (below).
- Timeout: `timeoutMs` covers the time to the **first** token (60 s). After that, an idle
  timeout of 30 s between chunks applies. A long answer that keeps arriving is never cut.
- `complete()` is unchanged.

### Routes

- `POST /api/ai/explain` `{ itemId }` and `POST /api/ai/optimize` `{ itemId }`.
- Same order as the actions:
  - zod, then auth (401), then the item by owner (`getItemForExplain` / the prompt query: 404),
    then the type check, then `aiGate` (Pro, `ai`, `aiDaily`, `aiGlobal`). Gate failures give
    403 or 429 with the translated message.
  - Move `aiGate` out of `src/actions/ai.ts` into `src/lib/ai-gate.ts`, so actions and routes
    share it.
- Success: `200 text/plain; charset=utf-8` and `Cache-Control: no-store`, with the deltas
  streamed as they come.
  - An error mid-stream appends a line `\n\n[[cortex:error:<translated message>]]` and closes
    the stream. The client recognises the marker and strips it.
- The French answer instruction (`FRENCH_ANSWER_INSTRUCTION`) is kept for Explain, as today.
- `export const maxDuration = 120` on both routes.
- **End-of-stream signals.** The client never sees `finish_reason`, since text deltas do not
  carry it. So:
  - `completeStream` reads `finish_reason` from the last chunk.
  - When it is `"length"`, the route appends `\n\n[[cortex:cutoff]]` before closing.
  - For Explain, the client shows the text with a "cut off" notice.
  - For Optimize, the client treats it as the existing cut-off error and never offers "Use".
- Optimize keeps its other validation: once the stream has ended without a cut-off, the client
  runs the same pure parse and length check as today (from `ai-output.ts`) before it offers
  "Use".
- Explain's existing cleanup also runs on the streamed text: strip a wrapping fence and apply
  the ~4,000-character cap.
  - The client applies `cleanExplanation` (from `ai-output.ts`) to the text accumulated so far
    on each render, and once more at the end.
  - The server stops forwarding text past the cap and appends the cut-off marker.
- The `explainCode` and `optimizePrompt` server actions are removed with their tests, which
  move to the routes.

### Client

- `src/lib/ai-stream-client.ts`: `streamAi(url, body, { onText, signal })`.
  - It reads `response.body` with a `TextDecoder`.
  - It calls `onText(accumulated)`, throttled to one call per animation frame.
  - It throws with the server message on a non-2xx answer or on the error marker.
- Explain tab:
  - The Markdown renders while it streams. A blinking caret shows until the end.
  - The button turns into "Stop", which aborts through `AbortController`. The partial text
    stays, marked "stopped".
- Optimize: same streaming view in the prompt header. "Use" / "Discard" appear only once the
  stream has finished and passed validation.
- **Drawer actions are no longer blocked**, because there is no server action in flight.

### Timeouts of the remaining actions

- Server actions inherit the page's `maxDuration` (see the `maxDuration` docs, "Server
  Actions"). Set `export const maxDuration = 60` on the pages that host Suggest Tags and
  Description:
  - every `(app)` page that renders the New Item dialog or the drawer
  - in practice, set it in `src/app/(app)/layout.tsx` if layout-level config applies to actions
    there. **Check this in the docs.** If it does not apply, set it on each page.

### Vercel

- Fluid compute and the plan's duration cap are checked as a prerequisite of A1. Reuse that
  result here.

## Testing

- `src/lib/ai-client.test.ts`:
  - `parseSseChunk`: split lines, comments, `[DONE]`, a JSON error event
  - `completeStream`: deltas joined, a non-2xx error mapped, a first-token timeout, an idle
    timeout (fake timers, mocked `fetch` with a hand-made stream)
- `src/lib/ai-gate.test.ts`: order and messages (moved from the action tests).
- Route tests for both: 401, 404 for another user's item, wrong type, Free 403, limits 429, a
  streamed body, a mid-stream error marker, the cut-off marker on `finish_reason: "length"`,
  and Explain capped.
- `ai-output.test.ts`: the optimize validation used by the client.
- Browser (demo account set Pro on develop, then reset):
  - Explain streams.
  - Stop works.
  - Favorite toggles while it streams.
  - Optimize streams, then Use and Discard.
  - Check in FR and EN.

## Notes

- Measure the first-token latency with the free model and write it in the History.
- The plan's original `/api/ai/explain` idea (`docs/ai-integration-plan.md` §3) is now done.

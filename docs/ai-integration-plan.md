# AI Integration Plan: OpenRouter + Nemotron 3 Ultra (free)

Research for adding the four "AI Superpowers" (auto-tagging, summaries, code explanation, prompt
optimization) to CodStash on OpenRouter's `nvidia/nemotron-3-ultra-550b-a55b:free`.

> **Update 2026-11-25:** the client is now provider-generic (`src/lib/ai-client.ts`, `AI_PROVIDER=openrouter|openai`): free Nemotron on OpenRouter first, then OpenAI GPT-6 Luna. See `context/features/ai-auto-tag-spec.md` and `docs/ai-model-pricing.md`. **Where this plan and the feature specs differ (client and env names, auto-tag input, explain transport, placement and input, limits including `aiDaily`), the specs win.**

Researched 2026-11-25. Context7 could not connect, so the OpenRouter and SDK facts come from
openrouter.ai docs and the SDK README (listed in [Sources](#sources)). Anything marked
**unverified** was not confirmed in a primary source.

---

## 1. Constraint that drives every decision: the free cap is account-wide

OpenRouter's limits for `:free` models (official limits page):

| Credits purchased (all time) | Requests / minute | Requests / day |
| ---------------------------- | ----------------- | -------------- |
| Under $10                    | 20                | 50             |
| $10 or more                  | 20                | 1,000          |

- These limits are **per OpenRouter account, not per CodStash user**. "Making additional accounts
  or API keys will not affect your rate limits."
- The daily counter resets at midnight UTC.
- `GET https://openrouter.ai/api/v1/key` returns `data.free_model_daily_requests: { used, limit,
  remaining }`. It does not report the per-minute limit.

### "Free" means $0 per request, with a request quota

- **The `:free` variant costs nothing per token.** Calling
  `nvidia/nemotron-3-ultra-550b-a55b:free` is billed $0, input and output. Its limit is the
  number of requests (table above), not money.
- **The same model also has a paid variant**, `nvidia/nemotron-3-ultra-550b-a55b` (no `:free`),
  served by paid providers (e.g. KT around $0.25/M input and $2/M output; DeepInfra around
  $0.40/M input and $1.76/M output). The model page lists those providers too. That is very
  likely why paid prices appear next to a "free" model (not verified). CodStash never calls the
  paid variant.
- **The $10 is not a payment for the model.** It is a one-time credit purchase that raises the
  `:free` daily cap from 50 to 1,000 requests. `:free` requests do not spend those credits; they
  stay in the account.
- **The only ways AI could cost money:**
  - calling the id without `:free`;
  - putting a paid model in the `models` fallback array, because a fallback request is billed at
    the price of the model that answered (§7).

Consequences for the design:

1. **Buy the $10 of credits before launch.** This unlocks the higher quota; it is not a usage
   cost. At 50 requests a day, three Pro users would use up the app's AI for the whole day. At
   1,000 a day the feature is usable.
2. **AI runs only when a user clicks a button.** Nothing runs on keystroke, on save or on item
   create. In particular, auto-tagging does **not** run automatically on create; it is a
   "Suggest tags" button.
3. **"Cost optimization" here means request budgeting.** Requests cost $0, but each one spends
   part of a shared daily quota. See [§7](#7-cost-and-quota-optimization).
4. **The free route is evaluation-grade.** The free Nemotron route promises neither capacity
   nor production availability, and free routes can be withdrawn without notice (the model
   page documents a 404 for "no provider can serve the request"). Put the model id in an env
   var (`OPENROUTER_MODEL`) so swapping models needs no code change.
5. **Data logging and training: product decision needed.** Third-party listings say the free
   endpoint is "rate limited and logged". Third-party guides and forum reports also say that
   free models are often served only by hosts that may **train on prompts**. If the account's
   privacy settings (openrouter.ai/settings/privacy) refuse training, every free host is filtered
   out and requests fail with 404 "No endpoints found matching your data policy". This is not
   confirmed by an official OpenRouter page, nor for Nemotron specifically. If it holds, using
   `:free` means agreeing that users' snippets, which can be private code, may be logged or used
   for training. That is the product owner's call (§13). Whatever is decided, say in the UI that
   AI features send the item's content to a third-party model.

### Model facts

| Fact | Value | Source |
| --- | --- | --- |
| Id | `nvidia/nemotron-3-ultra-550b-a55b:free` | model page |
| Architecture | MoE, 550B total, 55B active, reasoning model | third-party listings |
| Context / max output | 1M tokens / 65,536 (**unverified**, third-party) | listings |
| Price (`:free` id) | $0 input / $0 output; limited by requests only | limits page, listings |
| Endpoint | `POST https://openrouter.ai/api/v1/chat/completions` | model page |
| Accepted params | `max_tokens`, `reasoning`, `reasoning_effort`, `seed`, `temperature`, `tool_choice`, `tools`, `top_p`, `stream`, provider routing | model page |
| **Not listed** | `response_format`, `structured_outputs`, `include_reasoning` | model page |

The lack of `response_format` decides how auto-tagging gets its JSON ([§4.1](#41-auto-tagging)).

---

## 2. Client setup

### Recommendation: a thin `fetch` wrapper, `src/lib/openrouter.ts`

Model it on `src/lib/bictorys.ts`: server-only, reads the env at call time through a `config()`
helper, `AbortSignal.timeout`, error bodies cut to an excerpt, and typed results. Reasons:

- The REST API's request, response and error shapes are documented. The SDK's are not: its
  README has empty sections for errors, retries and timeouts, and documents no non-streaming
  `chat.send` response shape.
- It matches the existing Bictorys client and is easy to mock in Vitest (`vi.mock("@/lib/openrouter")`
  for the actions, `vi.stubGlobal("fetch", …)` for the client's own tests).
- No new dependency, and no ESM-only package in the server bundle.

Sketch of the surface (shape, not final code):

```ts
// src/lib/openrouter.ts. Server-only: reads OPENROUTER_API_KEY.
const BASE_URL = "https://openrouter.ai/api/v1";
/** Non-streaming calls run as server actions, which queue per client (§3). */
const TIMEOUT_MS = 15_000;

function config() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return { apiKey, model };
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    /** `error.metadata.error_type`, e.g. "rate_limit_exceeded". */
    readonly errorType: string | null,
    /** Seconds from `Retry-After`, on 429 and 503. */
    readonly retryAfter: number | null,
    message: string,
  ) { super(message); this.name = "OpenRouterError"; }
}

/** One non-streaming completion; returns the trimmed text, never "" (empty is an error). */
export async function complete(messages: ChatMessage[], opts: { maxTokens: number }): Promise<string>;

/** A streaming completion: the upstream Response, for the explain route to parse. */
export async function streamCompletion(messages: ChatMessage[], opts: { maxTokens: number; signal?: AbortSignal }): Promise<Response>;
```

Request body for every call (`max_tokens` here is only illustrative; each feature has its own
value, see §7):

```json
{
  "model": "<OPENROUTER_MODEL>",
  "messages": [...],
  "max_tokens": 1024,
  "temperature": 0.2,
  "reasoning": { "effort": "low", "exclude": true }
}
```

Optional attribution headers (documented on the app-attribution page): `HTTP-Referer: <APP_URL>`
and `X-OpenRouter-Title: CodStash`. They only put the app in OpenRouter's rankings. Send them
with `X-OpenRouter-App-Visibility: hidden` if CodStash should not appear publicly, or leave them
out.

### Alternative: the official SDK `@openrouter/sdk`

If the SDK is preferred, here is what the README documents:

```bash
npm add @openrouter/sdk   # through Windows npm, see CLAUDE.md
```

```ts
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  httpReferer: process.env.APP_URL,  // optional attribution
  appTitle: "CodStash",              // optional attribution
});

const result = await openRouter.chat.send({
  chatRequest: { model, messages, stream: true },
});
for await (const chunk of result) {
  chunk.choices[0]?.delta.content; // streamed text
}
```

- ESM only. `callModel`, tools and agents have moved to a separate package, `@openrouter/agent`,
  which CodStash does not need.
- **Unverified:** the non-streaming `chat.send` response shape, error class names, and
  timeout/retry options. The README leaves those sections empty. Check them in
  `node_modules/@openrouter/sdk` before relying on them.

### Environment

`.env.example` already has `OPENROUTER_API_KEY=""` (uncommitted change in the working tree). Add:

```
OPENROUTER_API_KEY=""
# Optional; defaults to nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_MODEL=""
```

Add `OPENROUTER_API_KEY: ""` to the `env` block in `vitest.config.mts`, next to the other blanked
keys, so tests can never reach OpenRouter.

---

## 3. Transport: server actions for three features, a route handler for one

| Feature | Output | Transport | Streaming |
| --- | --- | --- | --- |
| Auto-tagging | ≤ 5 short tags | Server action | No |
| Summary | 1–3 sentences | Server action | No |
| Prompt optimization | One rewritten prompt | Server action | No |
| Code explanation | Several markdown paragraphs | Route handler `POST /api/ai/explain` | Yes |

**Why the explanation is not a server action.** The Next 16 server-actions guide
(`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, "Sequential dispatch on the
client") says actions are dispatched **one at a time per client**. A 20-second AI action would
hold up the drawer's Save, Favorite and Pin until it finished. The three short features are
**assumed** to take a few seconds each, which would be acceptable. That is an assumption to
measure, not a fact: the free reasoning model can take several seconds just to start (§9), and
a 15-second summary would block Save just as an explanation would. So the short features get a
tighter timeout (15 s, §6). If measured latency is often high, move them to route handlers as
well (§13). A long streamed explanation belongs in a route handler,
which `coding-standards.md` also names for "long-running operations".

Set `export const maxDuration = 60` in the route file (route segment config, documented in
`03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`). For the server
actions, `maxDuration` is set on the page that uses them. The default should be enough, given
the 15-second timeout of the short calls.

### Server action pattern: `src/actions/ai.ts`

Follow `startCheckout` in `src/actions/billing.ts` and `createItem` in `src/actions/items.ts`:

```ts
"use server";

export type AiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

export async function suggestTags(itemId: string): Promise<AiResult<string[]>> {
  // 1. Validate input with Zod (itemId; or the unsaved text, see below).
  try {
    const session = await auth();
    if (!session?.user?.id) return failure("You are not signed in.");
    const userId = session.user.id;

    // 2. Pro gate: read now, not from the session (the token can be a request old).
    if (!canUseAi(await getPlanStatus(userId))) return failure(LIMIT_MESSAGES.ai);

    // 3. Per-user limit, then the global one (§5).
    const limit = await checkRateLimit("ai", userId);
    if (!limit.success) return failure(tooManyAttemptsMessage(limit.reset));

    // 4. Load the item by owner (another user's item is "not found"), build the prompt, call.
    // 5. Parse and validate the output; map OpenRouterError to a friendly message.
  } catch (error) {
    console.error("[ai] suggestTags failed:", error);
    return failure("AI is unavailable right now. Try again.");
  }
}
```

**Item id or text?** The edit form may hold unsaved changes. Sending the form's current text,
with Zod caps, lets suggestions reflect what the user sees, and the action needs no DB read.
That does make it possible to send arbitrary text through the action. That is acceptable,
because the text is still capped, Pro-gated and rate-limited, the same as any item content.
Recommendation: **send the current form text**, validated against the same `ITEM_LIMITS` as
`updateItem`, then truncated for the model ([§7](#7-cost-and-quota-optimization)).

---

## 4. Per-feature design

All prompts use a system message holding the instructions and a user message holding the item
content between delimiters. The content is treated as data (see [§8](#8-security)).

### 4.1 Auto-tagging

- **No `response_format: json_schema`.** The model page does not list `structured_outputs` or
  `response_format`, and adding `provider.require_parameters: true` would likely route to no
  provider (503 or 404).
- Instead, ask for **a single line of comma-separated, lowercase tags** (max 5). This is easier
  to parse than JSON and matches `toTags` in `src/lib/tags.ts`. Parse tolerantly: strip code
  fences, a leading `Tags:` and quotes, then run `toTags`.
- Validate with the item schema's tag rules: each tag 1–50 characters, at most 20 per item in
  total. Remove tags the item already has (case-insensitive), and keep at most 5 new ones.
- Include the user's existing tags in the prompt so the model reuses their vocabulary.
- If parsing leaves nothing, return "No tag suggestions for this item."

### 4.2 Summary

- Fills the **Description** field (≤ 2,000 chars, `ITEM_LIMITS.description`). Ask for 1–2
  plain-text sentences, at most about 300 characters. Strip markdown and cut at the limit.
- Available on text-content types (snippet, prompt, note, command). Links and files have no
  content to summarize, so the button is hidden for them.

### 4.3 Code explanation (streamed)

- Snippets and commands only. `language` is passed as a hint.
- `POST /api/ai/explain` with `{ itemId }` or `{ content, language }`. It runs the same gates as
  the actions (auth, `canUseAi` via `getPlanStatus`, both rate limits), then pipes the upstream
  SSE to the client as plain text chunks (`text/plain; charset=utf-8`). The client then needs
  no SSE parser.
- The client reads `response.body.getReader()` and appends text to state, with an
  `AbortController` behind a Stop button. On abort, the server's `request.signal` is passed
  upstream so OpenRouter stops generating too.
- Render with the existing `react-markdown` + `remark-gfm`, with **no raw HTML** (do not add
  `rehype-raw`). The output is read-only and never saved, unless a later spec adds that.
- `max_tokens` of about 1,500, plus reasoning headroom (§6).

### 4.4 Prompt optimization

- Prompt items only. Returns a rewritten prompt that keeps the user's intent, variables and
  placeholders (`{{var}}`, `$VAR`, `<tag>`), with no commentary or preamble.
- Strip a wrapping code fence or "Here is the improved prompt:" line from the output.
- Capped at `ITEM_LIMITS.content`. In practice it is limited by `max_tokens` of about 2,000.
- The result is shown as a suggestion next to the original, never written over it directly
  ([§9](#9-ui-patterns)).

---

## 5. Rate limiting: two layers, and why fail-open matters here

Add to `LIMITS` in `src/lib/rate-limit.ts`:

```ts
/** Per user: each call spends the app's shared OpenRouter free quota. */
ai: { attempts: 20, window: "1 h" },
/** Global (identifier "global"): kept under OpenRouter's account-wide 20 req/min. */
aiGlobal: { attempts: 18, window: "1 m" },
```

- **Per user** (`checkRateLimit("ai", userId)`) stops one Pro user from using up the day.
  Tune the number against the 1,000-a-day budget and the number of Pro users.
- **Global** (`checkRateLimit("aiGlobal", "global")`) keeps the app below OpenRouter's 20 RPM
  instead of finding out through 429s. Optionally add a daily global limiter just below 1,000
  so the app can tell users "AI's daily quota is used up, resets at 00:00 UTC" instead of
  failing.
- **`checkRateLimit` fails open.** Without Upstash, or with Upstash down, both limits allow
  everything. For auth that is the right trade-off. Here OpenRouter's own 429 becomes the real
  backstop, so it must be handled well (§6). Do not change the fail-open behaviour for the
  existing limits.
- Use `tooManyAttemptsMessage(reset)` for per-user hits. Its "Too many attempts" wording works
  well enough. Use a distinct message for global or daily hits: "AI is busy, try again in a
  minute."

---

## 6. Error handling

### OpenRouter error shape

```ts
type ErrorResponse = { error: { code: number; message: string; metadata?: Record<string, unknown> } };
```

| Status | `metadata.error_type` | Meaning | User message |
| --- | --- | --- | --- |
| 400 | `invalid_request` | bad params | "AI request failed." (log it, it is our bug) |
| 401 | `authentication` | bad or disabled key | "AI is unavailable right now." (log as config error) |
| 402 | `payment_required` | credits (not expected on `:free`) | same |
| 403 | `permission_denied`, `content_policy_violation`, `refusal` | moderation or guardrail | "The AI declined this content." |
| 404 | — | model withdrawn, no provider, or **the account's data policy excludes every free host** ("No endpoints found matching your data policy") | "AI is unavailable right now." (alert: check the privacy settings, or swap `OPENROUTER_MODEL`) |
| 408 / 504 | `timeout` | upstream timeout | "AI took too long. Try again." |
| 429 | `rate_limit_exceeded` | free cap hit (`Retry-After` header) | "AI is busy. Try again in N seconds/minutes." |
| 502 | `provider_unavailable` | model down | "AI is unavailable right now. Try again." |
| 503 | `provider_overloaded` | no provider available (`Retry-After`) | same |

### Traps specific to this API and model

1. **A 200 can still be an error.** A non-streaming 200 may contain `error` and no `choices`.
   Check for `error` before reading `choices[0].message.content`.
2. **Mid-stream errors.** Once streaming has started the status stays 200. The failure arrives
   as an SSE chunk with a top-level `error` and `choices[0].finish_reason: "error"`, and then the
   stream ends. The explain route must catch this and send the client a final error marker. The
   simplest form is a trailing line the client recognises, or closing the stream with
   `controller.error()`, which the client sees as a failed read.
3. **Reasoning tokens use up `max_tokens`.** "Reasoning tokens are considered output tokens",
   and they count against `max_tokens`. If reasoning uses the whole budget, the response is
   `finish_reason: "length"` with **empty content**, and the reasoning tokens are still counted.
   Mitigations:
   - send `reasoning: { effort: "low", exclude: true }`. `"none"` (or `enabled: false`)
     disables reasoning entirely. Measure output quality with both during implementation.
   - leave headroom: `max_tokens` well above the expected answer length.
   - treat empty content or `finish_reason: "length"` with no text as an error, never as an
     empty suggestion.
4. **Timeouts.** Use `AbortSignal.timeout(15_000)` for the non-streaming calls (tags, summary,
   prompt optimization). They run as server actions, and a hung request holds the client's
   action queue, Save included (§3). The streamed explanation runs in a route handler, so it can
   take longer (up to `maxDuration`, 60 s), with the user's Stop button to cut it short.
5. **No automatic retries.** Each retry spends quota. Retry at most once, and only on 502/503
   with a short `Retry-After`. Never retry on 429.

All of this mapping lives in `src/lib/openrouter.ts` (throwing `OpenRouterError`) plus one
`aiErrorMessage(error)` helper, so the three actions and the route share it.

---

## 7. Cost and quota optimization

The spend is requests, not dollars ([§1](#1-constraint-that-drives-every-decision-the-free-cap-is-account-wide)).

- **Explicit triggers only**: no AI on create, save, type or page load.
- **Truncate input.** Items can hold 100,000 characters. Send at most about 8,000 characters
  (head, plus a "[truncated]" marker) for tags, summary and prompt optimization, and about
  12,000 for explanations. Shorter input means faster responses and less chance of a timeout.
- **Fallbacks only to other `:free` models.** OpenRouter's `models: [...]` array retries the next
  model on any error, including a 429. "If a `:free` model is followed by a paid model … you're
  billed at the paid model's price." If a fallback is added, list only `:free` ids.
- **Small `max_tokens` per feature**: tags around 300, summary around 400, prompt around 2,000,
  explanation around 1,500, each plus reasoning headroom.
- **Disable buttons while a request is in flight**, so double clicks do not cost two requests.
- **Optional cache**: the same content and the same feature give the same answer. A short Redis
  cache keyed on `sha256(feature + content)` (Upstash is already a dependency) would save
  requests when a user clicks twice. Not needed for v1. Add it only if the quota gets tight.
- **Watch the quota**: `GET /api/v1/key` → `free_model_daily_requests`. Useful for an admin
  check or a log line, not for each request.

---

## 8. Security

- **API key**: only in `process.env.OPENROUTER_API_KEY`, read only inside `src/lib/openrouter.ts`,
  which is imported only by server actions and route handlers. Never use a `NEXT_PUBLIC_`
  prefix. Optionally add `import "server-only"` (as the Next data-security guide shows). Never
  log the key or the request headers.
- **Auth and ownership** on every entry point. If an `itemId` is accepted, load the item filtered
  by owner, as `updateItemQuery` does.
- **Pro gating on the server** through `getPlanStatus(userId)`. `session.user.isPro` is "for the
  UI only" (`src/types/next-auth.d.ts`).
- **Input validation**: Zod with the existing `ITEM_LIMITS` caps, then truncation for the model.
- **Prompt injection**: item content is untrusted. Put it in the user message between clear
  delimiters (for example `<content>…</content>`), and tell the system prompt that the content is
  data to analyse, not instructions. More important, **constrain what the output can do**:
  - tags pass through `toTags` and the tag Zod rules,
  - the summary is plain text cut to the description limit,
  - the explanation is rendered as markdown without raw HTML,
  - nothing is saved without the user pressing Save.
  An injected instruction can at worst produce odd text that the user then rejects.
- **Output is never trusted as HTML.** React escapes text, and `react-markdown` without
  `rehype-raw` drops HTML.
- **Privacy**: content is sent to OpenRouter and then to a model provider, and possibly logged
  or used for training on the free route (§1, item 5). Say so next to the AI buttons or in the
  privacy text. The routing options `provider: { data_collection: "deny" }` and `zdr: true` (the
  SDK README example uses `zdr: true`) **probably leave no host for the free route**, for the
  same reason the account setting does (404, §6). Test them once before relying on them. If
  private code must not be used for training, the realistic choice is the paid variant with
  `data_collection: "deny"`, not the free route.
- **Error messages**: users see the friendly strings in §6. Raw upstream bodies only go to
  `console.error`, cut to an excerpt (as `bictorys.ts` does with `MAX_ERROR_BODY`).

---

## 9. UI patterns

Where the buttons go: the item drawer's **edit mode** (`ItemEditForm.tsx`), next to the fields
they fill:

| Button | Placement | Applies to |
| --- | --- | --- |
| ✨ Suggest tags | beside the Tags field | all text types |
| ✨ Summarize | beside the Description field | snippet, prompt, note, command |
| ✨ Optimize prompt | above the Content editor | prompt |
| ✨ Explain | in the view-mode action bar (`ItemActionBar.tsx`), opens a panel | snippet, command |

**Suggest, never auto-save.** A suggestion only changes the form's local state. The user
accepts it by keeping it and pressing the form's normal **Save**, which goes through
`updateItem` and its validation.

- **Tags**: show suggestions as clickable chips under the field. Clicking a chip adds that tag to
  the `tags` string; there is also "Add all" and dismiss (×).
- **Summary**: show the suggestion in a small preview with **Use** (replaces the Description
  state) and **Dismiss**. If the description is empty, filling it directly is fine, because the
  user can still undo by editing before Save.
- **Prompt optimization**: show the original and the suggestion side by side, or stacked on
  mobile, with **Replace** and **Discard**. Keep the original in state so Replace can be undone
  until Save.
- **Explanation**: a collapsible panel under the content that streams markdown in as it arrives,
  with a Stop button and a Copy button. It is read-only.

Loading and errors:

- `useTransition` for the server-action buttons (the pattern `ItemEditForm` already uses). The
  button shows a spinner and "Thinking…", and it is disabled while pending. Other AI buttons stay
  enabled, but their actions queue behind it (§3).
- The explanation panel shows a skeleton line until the first chunk arrives, because free
  reasoning models can take several seconds to start.
- Failures go to a `sonner` toast with the friendly message (§6), as elsewhere in the app.

**Free users**: hide the AI buttons, or show them disabled with a "Pro" badge that links to
`/upgrade`, in keeping with the Files/Images upsell. Feed the flag from a `loadAiAllowed()`
modelled on `src/lib/load-uploads-allowed.ts`. It is UI only, since the actions check again.

---

## 10. Pro gating

Extend `src/lib/usage-limits.ts`, which is pure and client-safe:

```ts
/** AI features are Pro-only. */
export function canUseAi(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

export const LIMIT_MESSAGES = {
  // …existing
  ai: "AI features are a Pro feature.",
} as const;
```

- Server: every AI action and the explain route call `canUseAi(await getPlanStatus(userId))`
  after auth and **before** the rate limits, so Free users do not use up limiter slots.
- UI: `loadAiAllowed()` (copy of `loadUploadsAllowed`, failing closed to `false`), passed down
  from the `(app)` layout in the same way.

---

## 11. Testing

Unit tests only, following CLAUDE.md, with no real network:

- `src/lib/openrouter.test.ts`: stub `fetch` to check the request body (model, `max_tokens`,
  `reasoning`), the auth header, error mapping for each status in §6, **200 with `error`**,
  **empty content / `finish_reason: "length"`**, and `Retry-After` parsing.
- `src/lib/ai-output.test.ts` (or wherever the parsers live): tag parsing (code fences,
  `Tags:` prefix, duplicates, over-long tags, cap of 5, existing tags removed), summary cleanup
  and truncation, prompt-output fence stripping.
- `src/actions/ai.test.ts`: mock `@/auth`, `@/lib/db/billing` (`getPlanStatus`),
  `@/lib/rate-limit` and `@/lib/openrouter`. Cover not signed in, Free → `LIMIT_MESSAGES.ai`,
  rate limited, validation errors, the happy path, and an upstream error mapped to a friendly
  message.
- `src/lib/usage-limits.test.ts`: `canUseAi`.
- The explain route handler is outside Vitest's include globs (`src/app/**`). Keep its logic in
  `src/lib/` (gates and SSE-to-text transform) so that part can be tested, and check the route
  itself in the browser.

---

## 12. Suggested file map

| File | Change |
| --- | --- |
| `src/lib/openrouter.ts` (+ test) | new: fetch client, `OpenRouterError` |
| `src/lib/ai-prompts.ts` | new: system prompts and input truncation per feature |
| `src/lib/ai-output.ts` (+ test) | new: output parsers and validators |
| `src/actions/ai.ts` (+ test) | new: `suggestTags`, `summarizeItem`, `optimizePrompt` |
| `src/app/api/ai/explain/route.ts` | new: streamed explanation, `maxDuration` |
| `src/lib/usage-limits.ts` | add `canUseAi`, `LIMIT_MESSAGES.ai` |
| `src/lib/rate-limit.ts` | add `ai`, `aiGlobal` limits |
| `src/lib/load-ai-allowed.ts` (+ test) | new: UI flag |
| `src/components/items/ItemEditForm.tsx`, `ItemActionBar.tsx` | AI buttons |
| `src/components/items/` (new `AiSuggestion*.tsx`, `CodeExplanation.tsx`) | suggestion and stream UI |
| `.env.example`, `vitest.config.mts` | `OPENROUTER_MODEL`; blank `OPENROUTER_API_KEY` in tests |

Suggested order: client and gating first, then tags, the smallest end-to-end slice. Then
summary, then prompt optimization, then the streamed explanation.

---

## 13. Open questions and follow-ups

- **Docs out of date**: `context/project-overview.md` still says "AI powered by **OpenAI
  gpt-5-nano**" (Features §F, the stack table and the architecture diagram). Update it when the
  feature is specced. It was not changed here, because this research is documentation only.
- **Data policy (decide before building):** does the free Nemotron route only work if the
  account allows prompt logging or training? If yes, is that acceptable for users' private
  snippets, or should CodStash use the paid variant with `data_collection: "deny"`? Check by
  sending one request with training refused in the account's privacy settings.
- Will the account get the $10 of credits for the 1,000-a-day tier?
- Measured latency of the short features: if tags, summary or prompt optimization often take
  more than about 10 seconds, move them to route handlers too (§3).
- Per-user AI limit: 20 an hour is a placeholder. Choose it from the expected number of Pro
  users.
- Reasoning `"low"` vs `"none"`: settle it by trying both on real items.
- Confirm on the live model page: context length, max output, data logging, and whether
  `zdr` / `data_collection: "deny"` still leave a provider for the free route.
- Should explanations be saveable (for example appended to the item's description)? The spec
  does not say, so v1 keeps them read-only.

---

## Sources

- OpenRouter: API rate limits — https://openrouter.ai/docs/api/reference/limits
- OpenRouter: errors — https://openrouter.ai/docs/api-reference/errors
- OpenRouter: model page — https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free
- OpenRouter: structured outputs — https://openrouter.ai/docs/features/structured-outputs
- OpenRouter: reasoning tokens — https://openrouter.ai/docs/use-cases/reasoning-tokens
- OpenRouter: model fallbacks — https://openrouter.ai/docs/guides/routing/model-fallbacks
- OpenRouter: app attribution — https://openrouter.ai/docs/app-attribution
- OpenRouter: TypeScript SDK overview — https://openrouter.ai/docs/client-sdks/typescript/overview
- `@openrouter/sdk` README — https://cdn.jsdelivr.net/npm/@openrouter/sdk/README.md and
  https://github.com/OpenRouterTeam/typescript-sdk
- OpenRouter help center, free-model limits — https://openrouter.zendesk.com/hc/en-us/articles/39501163636379
- Third-party (model facts and rate-limit history, lower trust):
  https://freellm.net/models/openrouter/nvidia-nemotron-3-ultra-550b-a55b,
  https://aireiter.com/blog/nemotron-3-ultra-api-guide,
  https://fast.io/resources/openrouter-rate-limit.md,
  https://www.truefoundry.com/es/blog/openrouter-rate-limits-your-free-tier-depends-on-what-youve-already-paid,
  https://www.requesty.ai/blog/openrouter-free-models
- Third-party (free routes and data policy, lower trust):
  https://www.truefoundry.com/ja/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you,
  https://help.janitorai.com/en/article/openrouter-errors-10ear52,
  https://forum.cursor.com/t/qwen3-6-provider-error-resource-not-found/158337
- Next.js 16 docs in `node_modules/next/dist/docs/01-app/`: `02-guides/server-actions.md`
  (sequential dispatch), `02-guides/data-security.md` (`server-only`),
  `03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`
- Codebase: `src/actions/items.ts`, `src/actions/billing.ts`, `src/lib/usage-limits.ts`,
  `src/lib/rate-limit.ts`, `src/lib/bictorys.ts`, `src/lib/load-uploads-allowed.ts`,
  `src/lib/tags.ts`, `src/types/next-auth.d.ts`, `prisma/schema.prisma`

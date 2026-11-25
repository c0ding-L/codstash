# AI Explain Code

## Overview

Add AI-powered code explanation for snippets and commands in the item drawer. These are the two
item types where explanation adds value — actual code and terminal commands. Other types (prompts,
notes, links, files, images) are already human-readable or non-code. Pro-only feature. Explanation
displays inline via a tab interface in the code editor, not as a separate panel.

**Provider:** the same as auto-tag, through the generic client `src/lib/ai-client.ts`: free
`nvidia/nemotron-3-ultra-550b-a55b:free` on OpenRouter now, then `gpt-6-luna` on OpenAI direct
(`AI_PROVIDER=openai`). The switch is env vars only; nothing in this feature depends on the
provider.

**Prerequisite:** auto-tag (`context/features/ai-auto-tag-spec.md`) is implemented. This feature
**reuses** its foundation and creates none of it again.

## Reused from auto-tag

| Piece | From |
| --- | --- |
| `complete(messages, { maxTokens })`, `AiProviderError`, provider adapter, 15 s timeout | `src/lib/ai-client.ts` |
| `aiErrorMessage(error)` (toasts, spend-limit 429 → "unavailable") | auto-tag |
| `canUseAi(plan)`, `LIMIT_MESSAGES.ai` | `src/lib/usage-limits.ts` |
| `ai` (20/h per user), `aiDaily` (50/day per user) and `aiGlobal` (18/min) limits, and their messages | `src/lib/rate-limit.ts`, auto-tag spec |
| `loadAiAllowed()` (UI flag, fails closed) | `src/lib/load-ai-allowed.ts` |
| Server action file | `src/actions/ai.ts` (add `explainCode` next to `generateAutoTags`) |
| `AI_PROVIDER`, `AI_MODEL`, keys | one `AI_MODEL` for every feature (the Luna vs Terra A/B in `docs/ai-model-pricing.md` §6 is a follow-up) |

## Requirements

- Create an `explainCode` server action in `src/actions/ai.ts` with Zod validation, auth, Pro
  gating and rate limiting, in the same order as `generateAutoTags` (Pro gating **before** the rate
  limits).
- **Input is `{ itemId }`** (Zod: non-empty string). The read view only shows saved items, so the
  server reads the content itself:
  - Load the item **by owner**: add a small query to `src/lib/db/items.ts` (e.g.
    `getItemForExplain(userId, id)`, in `src/lib/db/`, not in the `"use server"` file) selecting `content`, `language` and the item type's slug,
    filtered by `{ id, userId }` like `getItemDetail`. (`getItemDetail` does not return the type.)
    Another user's item, or a missing one, returns "Item not found."
  - Reject types other than snippet and command on the server (`isCodeType`), and empty content.
- Truncate content to **12,000 chars** with a `[truncated]` marker before the call. Pass
  `language` as a hint in the prompt.
- Prompt: system message asks for a concise explanation (**~200-300 words**) of what the code does
  and the key concepts, in Markdown, no preamble; the content goes between `<content>` delimiters
  and is data, not instructions.
- `maxTokens` **1,500** (~400 visible tokens plus reasoning headroom on the free model: a 12,000-char
  input used up to 939) and a **60 s** timeout for this call only (`complete(..., { timeoutMs })`);
  measured 27-42 s on the free model.
- Clean the output: strip a wrapping ```` ```markdown ```` / ```` ``` ```` fence around the whole
  answer, trim, cap at ~4,000 chars. Empty content or `finish_reason: "length"` with no text is an
  error (same rule as auto-tag).
- Add an "Explain" button (Sparkles icon) to the code editor window controls header, next to the
  Copy button.
- Only show it for snippet and command types in the **item drawer read view**, never in the
  create/edit forms. `CodeEditor` is shared with the edit form (`item-form-fields.tsx`), so the
  feature is **opt-in through a prop that only `ItemBody` passes** (e.g. `explain={{ itemId,
  aiAllowed }}`).
- After generating, show **Code / Explain** tabs in the editor header to toggle between views.
  Switching tabs never triggers a new request; the Explain button runs it again only on click.
- Render the explanation as Markdown in the same container space as the code editor, with
  `react-markdown` + `remark-gfm` and **no `rehype-raw`** (no raw HTML). Reuse the styling of
  `MarkdownEditor.tsx` (the `markdown-preview` class and its `components`, exported if needed) so
  it matches notes.
- Reset: clear the explanation (back to the Code tab) when the drawer shows another item or after
  the item is saved.
- Loading state: `Loader2` spinner while generating; the button is disabled while pending
  (`useTransition`), so a double click does not spend two requests.
- Pro gating in UI: for free users, show a **Crown** icon + tooltip ("AI features require Pro
  subscription") instead of a working button (`src/components/ui/tooltip.tsx`). The flag is the
  `aiAllowed` promise from `loadAiAllowed()`, following the auto-tag path extended to the editor:
  `(app)` layout → `ItemDrawerProvider` → `ItemDetails` → `ItemBody` → `CodeEditor`. UI only — the
  action checks again.
- Check the shared daily cap `aiDaily` (added by auto-tag) after `ai`, like `generateAutoTags`
  (see Cost).
- Error handling via toast (Pro gating, rate limit, not found, AI service errors) through
  `aiErrorMessage`.
- Same provider-neutral privacy line as auto-tag (e.g. in the tooltip or under the tabs).
- Follow existing patterns.
- Unit tests (see Testing).

## Cost

Explanations are the costliest feature on the planned model. Per request on Luna ($0.10 / $0.50
per M): ~3,300 input + 400-1,000 output tokens ≈ **$0.0005-0.0008**.

- The `ai` limit is **one counter shared with tags**: 20 requests/hour per user, all AI features.
- Without a daily cap, a user at 20/h all month (14,400 requests) costs **$7.60-12** on Luna, more
  than the **$7** Pro price (and ~$120 on Terra).
- With `aiDaily` at 50/day (1,500/month), the worst case is **~$1.25** on Luna (~$12.50 on Terra).
- `checkRateLimit` fails open without Upstash; the OpenAI hard spend limit (auto-tag spec, "Switch
  day") stays the real backstop.

## Transport: a server action, not streamed

The plan (`docs/ai-integration-plan.md` §3, §4.3) proposed a streamed route handler for long
explanations. This spec keeps a **server action**, because the output is short (~300 words).
Trade-off: server actions run one at a time per client, so the drawer's Favorite and Pin wait
until the explanation returns (at most the 60 s timeout). If measured latency is often bad, the
follow-up is the plan's streamed `/api/ai/explain` route.

## Switch day (OpenRouter free → OpenAI `gpt-6-luna`)

The same checklist as auto-tag (`context/features/ai-auto-tag-spec.md`). The switch is app-wide
and done once, for every AI feature. Only when the author has bought credits **and** says to
switch.

1. Buy at least **$5** of credits on OpenAI (Build tier). On the CodStash project, set a **hard
   spend limit** and a **spend alert** below it. Required: `checkRateLimit` fails open without
   Upstash, so the spend limit is the only cost backstop.
2. Set `OPENAI_API_KEY` and `AI_PROVIDER=openai` in `.env` **and** wherever production reads its
   env (`next start` reads `.env.production`). **Clear `AI_MODEL`** (or set it to `gpt-6-luna`):
   a leftover Nemotron id would be sent to OpenAI and fail. Restart the server.
3. Make one real call and check:
   - content is non-empty with `reasoning_effort: "none"`;
   - Chat Completions accepts the top-level `reasoning_effort` (the model page documents the
     Responses-style `reasoning.effort`);
   - `max_completion_tokens` is accepted, and omitting `temperature` causes no error;
   - the error body shape, and the code for an out-of-credits account. Update the adapter table
     and `aiErrorMessage` if they differ.
4. Explain-specific: run one real explanation of a long snippet (close to the 12,000-char cap) and
   check the answer is complete within `maxTokens` 1,500 (no `finish_reason: "length"`), and
   that latency stays well under the 60 s timeout (Luna has no reasoning, so 15 s may do again).
5. Update the privacy wording in docs if needed (the UI is provider-neutral).

## Testing

- `src/actions/ai.test.ts` (`explainCode`): mock `@/auth`, `@/lib/db/billing`, `@/lib/db/items`,
  `@/lib/rate-limit`, `@/lib/ai-client`. Cover not signed in, Free → `LIMIT_MESSAGES.ai` (rate
  limiters not called), `ai` / `aiGlobal` / `aiDaily` limits, invalid input, item not found or not
  owned, wrong type (note, link…), empty content, truncation at 12,000 chars with the marker,
  `language` in the prompt, happy path, upstream error → friendly message.
- Output cleanup tests next to the tag parser (`src/lib/ai-output.test.ts`): wrapping fence
  stripped, inner code blocks kept, trim, length cap, empty → error.
- `src/lib/db/items.test.ts`: the new owner-scoped query filters by `userId`.
- `src/lib/rate-limit.test.ts`: `aiDaily` exists if the tests list limits.

## Notes

- Explanations are not saved to the database — regenerated on each click.
- Not available in create/edit forms, only in the item drawer read view.
- Prompt injection: the content is untrusted; the output is plain Markdown rendered without raw
  HTML and never saved, so an injected instruction can at worst produce odd text.

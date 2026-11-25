# AI Model Pricing: from free Nemotron to GPT-6 Luna

Pricing and model comparison for CodStash's four AI features (auto-tagging, summaries, code
explanation, prompt optimization), and the checklist for the switch from today's free model to a
paid one.

- **Today:** `nvidia/nemotron-3-ultra-550b-a55b:free` through OpenRouter (see
  `docs/ai-integration-plan.md` and `context/features/ai-auto-tag-spec.md`).
- **Later:** credits on an **OpenAI API account, used directly**, with **GPT-6 Luna** (Terra was
  the first candidate; see §6).

> **Decision 2026-11-25:** option (b) of §7, a generic client. Free Nemotron on OpenRouter now; switch to **GPT-6 Luna on OpenAI direct** around 2026-11-27, by env vars only. See `context/features/ai-auto-tag-spec.md`.

Researched 2026-11-25. Each fact is tagged by source:
**[OpenAI]** official developers.openai.com / openai.com page,
**[OR]** openrouter.ai page or docs,
**[3P]** third-party aggregator (lower trust).
Gaps are listed as gaps; nothing was filled in from memory. Prices change: check the live pages
before buying credits.

---

## 1. TL;DR

1. **Cost per request is tiny; worst-case cost per user is not.** A tag request costs about
   $0.002 on Terra and $0.0002 on GPT-6 Luna. But a Pro user pays **$7/month** (`billing-plans.ts`),
   and the planned limit of 20 AI requests/hour allows up to 14,400 requests/month: about **$33**
   of Terra tags, or **$177** of Terra prompt optimizations, per user. The per-user rate limit is the
   real spending cap and must be redesigned before going paid (§5).
2. **GPT-6.1 Terra is a reasonable but probably oversized choice** for tags and summaries. OpenAI
   positions it as its mid-size model; **GPT-6 Luna** is the official "cost-sensitive, high-volume"
   option at **one tenth** of the price, with the same context, endpoints and structured outputs.
   Recommendation: Luna for tags and summaries, and decide Terra vs Luna for code explanation and
   prompt optimization with a quick A/B on real items (§6).
3. **OpenAI direct vs OpenRouter:** same list price; OpenRouter adds a 5.5% fee on credit
   purchases but keeps the switch to a one-line env change. OpenAI direct gives a hard spending
   limit, clearer data terms and no fee, but needs a second client or a configurable one (§4).
4. **Paid OpenAI settles the spec's open data question:** API data is not used for training by
   default; retained up to 30 days for abuse monitoring **[OpenAI]**.
5. **Decide the client shape now**, before implementing auto-tagging: write `src/lib/ai-client.ts`
   as a generic OpenAI-compatible client (base URL, key and model from env) so the switch needs no
   rewrite (§7).

---

## 2. GPT-6.1 Terra and GPT-6 Luna (official facts)

OpenAI's current line, cheapest to most capable: Luna, Terra, Sol, Astra **[3P]**. Terra launched
2026-10-26 **[OpenAI announcement]**. OpenAI still recommends Sol or Astra for the hardest coding
tasks **[3P]**.

| | `gpt-6.1-terra` | `gpt-6-luna` |
| --- | --- | --- |
| Positioning | mid-size; "on par with GPT-6 Astra at one tenth the price" **[3P quoting OpenAI]** | "for cost-sensitive, high-volume workloads" **[OpenAI]** |
| Input / cached / output, $/M (Standard) | **$1 / $0.05 / $5** | **$0.10 / $0.01 / $0.50** |
| Batch and Flex | $0.50 / $0.025 / $2.50 | $0.05 / $0.005 / $0.25 |
| Fast mode (ex-Priority) | $2 / $0.10 / $10 | $0.20 / $0.02 / $1.00 |
| Input > 272K tokens | $2 / $0.10 / $7.50 | $0.20 / $0.02 / $0.75 |
| Context / max input / max output | 1,050,000 / 922,000 / 128,000 | same |
| Knowledge cutoff | 2026-06-01 | 2026-05-18 |
| Endpoints | Chat Completions, Responses, Batch | same |
| Structured outputs | yes | yes |
| `reasoning.effort` | `none`, `low`, `medium` (default), `high`, `xhigh`, `max` | same |

All rows **[OpenAI]** model pages and pricing page, unless tagged. Notes:

- **Default effort is `medium`.** For tags and summaries send `none` or `low`, or the request
  spends reasoning tokens (billed as output) for nothing.
- Background windows are 30% (2 h) or 40% (8 h) below Standard, and regional processing costs
  +10% **[OpenAI]**. Batch, Flex and background are not suitable here, because users wait for the
  answer.
- **Gaps:** `verbosity` support (OpenRouter lists the parameter, OpenAI model pages don't
  mention it), and whether `temperature` is accepted (OpenRouter does not list it for Terra or
  Luna; **do not send it** until verified).

---

## 3. Alternatives (OpenRouter list prices)

All **[OR]** model pages, which give prices and accepted parameters only. Context, max output,
latency and data policy per provider were **not** on the fetched pages.

| Model | Cheapest listed in / out $/M | `response_format` | `reasoning` | Notes |
| --- | --- | --- | --- | --- |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | $0 / $0 | **not listed** | yes | today's model; 20 req/min, 50 or 1,000 req/day per account |
| `nvidia/nemotron-3-ultra-550b-a55b` (paid) | $0.25 / $2 (KT) | yes | yes | 8 providers, up to $0.75 / $3.30 |
| `openai/gpt-6-luna` | $0.10 / $0.50 (Standard) | yes | yes | also $0.05/$0.25 and $0.20/$1.00 lines (match OpenAI's Flex / Fast prices) |
| `openai/gpt-6.1-terra` | $1 / $5 (Standard) | yes | yes | also $0.50/$2.50 and $2/$10 lines (match OpenAI's Flex / Fast prices); Azure, Vertex, Bedrock too |
| `anthropic/claude-haiku-5.5` | $0.10 / $0.50 | yes | yes | Anthropic, Vertex, Bedrock, Azure |
| `deepseek/deepseek-v4.1-flash` | $0.051 / $0.567 (Wafer), $0.112 / $0.336 (DeepInfra) | yes | yes | 36 provider lines, up to $1.50 / $6 |
| `qwen/qwen3.7-flash` | $0.03 / $0.13 | yes | yes | Alibaba Cloud only; 1M context **[3P]** |
| `openai/gpt-oss-20b` | $0.015 / $0.077 | yes | yes | open weights, 10 providers |

- On OpenRouter it is **unverified which OpenAI line** (Flex, Standard or Fast) a plain request is
  routed to. The Standard price is the one to plan with.
- Every paid alternative accepts `response_format`, so JSON output becomes possible after the
  switch (§7).
- Cheaper open models (DeepSeek, Qwen, gpt-oss) are spread over many hosts with very different
  prices and data policies. They only make sense through OpenRouter with `data_collection: "deny"`
  and should be judged on output quality first.

---

## 4. OpenAI direct vs OpenRouter (same model)

| | OpenAI direct | OpenRouter |
| --- | --- | --- |
| Token price | list price **[OpenAI]** | same list price, "no markup on inference pricing" **[OR FAQ]** |
| Fee | none found | **5.5% on credit purchases, $0.80 minimum** (5% crypto) **[OR FAQ]** |
| Credit expiry | not researched | may expire after one year **[OR FAQ]** |
| Rate limits | tiers: Build after **$5** of purchases → Terra 5,000 RPM / 1M TPM, Luna 5,000 RPM / 2M TPM; Launch ($100), Grow ($500). No RPD listed. **[OpenAI]** | **no platform cap on paid models**; upstream provider 429s still possible **[OR limits]** |
| Monthly usage ceiling | per tier: Build $500, Launch $5,000, Grow $200,000 **[OpenAI]** | none found |
| Hard spending cap | **project or org hard limit → 429 `project_spend_limit_exceeded`**; resets monthly; "not instantaneous" **[OpenAI]** | per-key credit `limit` (`GET /api/v1/key`) → 402 with `metadata.limit_source: "openrouter_key_limit"`; how to set it via API not documented on the fetched page **[OR]** |
| Spend alerts | yes, notification only **[OpenAI]** | none found; poll `GET /api/v1/key` |
| Training on data | **no by default** (since 2023-03-01) **[OpenAI]** | OpenRouter itself logs no prompts by default; per-provider policy, separate privacy toggles for paid and free models **[OR]**; OpenAI as a provider not described on the fetched pages |
| Retention | up to **30 days** for abuse monitoring; ZDR only with OpenAI's prior approval **[OpenAI]** | `provider.zdr: true` restricts routing to ZDR endpoints **[OR]** |
| EU data residency | available for Luna (Standard, Fast, Flex, Batch) **[OpenAI]** | Azure EU only, Business/Enterprise plan **[OR]** |
| Model choice | OpenAI only | 400+ models, one key; swap = change `OPENROUTER_MODEL` |
| Client | new client or configurable base URL | client already planned |

**Reading of the table.** For a single-provider setup on Terra/Luna, OpenAI direct is cheaper (no
5.5%), has a real hard cap, alerts and the clearest data terms. OpenRouter keeps model swaps free
(useful while it's unclear whether Luna is good enough) and is what the free phase already uses.
Neither choice is wrong; it is a product decision. The cost of keeping both open is small if the
client is generic (§7).

---

## 5. Cost estimates

### Assumptions

Tokens ≈ characters / 4. System prompt ≈ 300 tokens. Output includes some reasoning at `low`
effort; with `none` it is lower. Input caps are the ones in the plan and spec.

| Feature | Input cap | Input tokens | Output tokens |
| --- | --- | --- | --- |
| Tags | 2,000 chars | ~800 | ~300 |
| Summary | ~8,000 chars | ~2,300 | ~400 |
| Prompt optimization | ~8,000 chars | ~2,300 | ~2,000 |
| Code explanation | ~12,000 chars | ~3,300 | ~1,500 |

### Cost per request (Standard)

| Feature | Terra | Luna | Paid Nemotron (KT) | Haiku 5.5 |
| --- | --- | --- | --- | --- |
| Tags | $0.0023 | $0.00023 | $0.0008 | $0.00023 |
| Summary | $0.0043 | $0.00043 | $0.0014 | $0.00043 |
| Prompt optimization | $0.0123 | $0.0012 | $0.0046 | $0.0012 |
| Code explanation | $0.0108 | $0.0011 | $0.0038 | $0.0011 |

Formula: `input × price_in / 1e6 + output × price_out / 1e6`. Haiku 5.5 has Luna's list price
**[OR]**, so its row is the same.

### Per user and per month

Average over the four features: **~$0.0074 per request on Terra, ~$0.00074 on Luna**.

| Scenario (30 days) | Requests | Terra | Luna |
| --- | --- | --- | --- |
| Light Pro user: 5 requests/day | 150 | $1.11 | $0.11 |
| Heavy Pro user: 30 requests/day | 900 | $6.66 | $0.67 |
| **Worst case at the planned 20/h**, tags only | 14,400 | **$33** | $3.30 |
| **Worst case at 20/h**, prompt optimization only | 14,400 | **$177** | $17.70 |
| 50 Pro users at 10/day | 15,000 | $111 | $11 |

Against **$7/month** per Pro user (`src/lib/billing-plans.ts`, before payment fees; the yearly
plan, $63, is $5.25/month):

- **Terra:** a heavy user nearly eats the subscription, and an abusive one costs 5 to 25 times it.
- **Luna:** even the worst case at 20/h stays around half the subscription for the cheap features.

### What this means for the limits

- Keep `ai` per user, but add a **daily** cap, e.g. `aiDaily: { attempts: 50, window: "1 d" }`
  (Upstash sliding windows accept `"1 d"`). At 50/day the Terra worst case is ~$18/month for
  prompt optimization and ~$3.50 for tags. Tune it once real usage is known.
- `aiGlobal` (18/min) only existed for the free model's 20 req/min account cap. With paid OpenAI
  at 5,000 RPM it is no longer needed for quota. Keep a looser global limit only as a cost circuit
  breaker, or drop it.
- **`checkRateLimit` fails open** (no Upstash = no limit). With a paid model that means no cost
  cap in the app: the **OpenAI hard spend limit is the only backstop**, so set it before launch.

---

## 6. Recommendation

| Feature | Model | Why |
| --- | --- | --- |
| Tags | **Luna**, effort `none` | short classification; Terra is 10× the price for little gain |
| Summary | **Luna**, effort `none`/`low` | 1–2 sentences |
| Prompt optimization | Luna first, **A/B vs Terra** | quality matters, longest output, the priciest feature on Terra |
| Code explanation | Luna first, **A/B vs Terra** | quality matters; Terra if Luna's explanations are shallow |

- Make the model per feature, not global: e.g. `AI_MODEL_FAST` (tags, summary) and `AI_MODEL_SMART`
  (explain, prompt), both env vars; this pair replaces the single `AI_MODEL` of §7(b). With one
  variable, use Luna.
- A/B: run 10–20 real items of each type through both models and compare by hand. Cost of the
  whole test: under $1.
- Terra is a sound choice if the A/B says Luna is not good enough; the limits in §5 then matter
  more.

---

## 7. Transition checklist

### Decision first (before implementing auto-tagging)

Pick one:

- **(a) Stay on OpenRouter for paid models too.** Switch = set `OPENROUTER_MODEL=openai/gpt-6-luna`
  (or `openai/gpt-6.1-terra`), buy credits, and handle the parameter changes below. Pay 5.5% on
  credits.
- **(b) OpenAI direct.** Write the planned client as a **generic OpenAI-compatible
  Chat Completions client**, with base URL, key and model from env (e.g. `AI_BASE_URL`,
  `AI_API_KEY`, `AI_MODEL`), and keep the provider differences (reasoning parameter, token cap
  name, error shape) in one place. Then the switch is env vars plus a small adapter.
  **Chosen.** The env names actually used (`AI_PROVIDER`, per-provider keys, `AI_MODEL`) are in
  `context/features/ai-auto-tag-spec.md`.

Either way, keep the comma-separated tag parser from the spec: it works on every model, and
structured outputs can be added later as an improvement.

### What changes when moving to OpenAI direct

| Area | Free Nemotron via OpenRouter | OpenAI direct (Terra / Luna) |
| --- | --- | --- |
| Endpoint | `https://openrouter.ai/api/v1/chat/completions` | `https://api.openai.com/v1/chat/completions`. **Responses API not required**: Chat Completions is supported and no tools are needed **[OpenAI]** |
| Key | `OPENROUTER_API_KEY` (in `.env`) | add `OPENAI_API_KEY` to `.env`, `.env.example`, and **blank it in `vitest.config.mts`** |
| Reasoning | `reasoning: { effort: "low", exclude: true }` | `reasoning_effort: "none"` or `"low"` (default `medium` costs more) |
| Token cap | `max_tokens` | `max_completion_tokens` (OpenRouter lists both for Terra/Luna; whether OpenAI direct still accepts `max_tokens` on these models is **unverified**) |
| Temperature | `0.2` | **don't send** until verified (not listed for Terra/Luna on OpenRouter) |
| JSON | not available | `response_format: { type: "json_schema", ... }` available; optional |
| Empty output | reasoning eats `max_tokens` → empty content | same trap, officially documented: the cap includes reasoning tokens and can end "before any visible output tokens are produced" **[OpenAI]**. Keep "empty or `finish_reason: "length"` = error"; leave headroom |
| 200 with `error` | OpenRouter trap | OpenRouter-specific; harmless to keep the check |
| 429 meaning | free quota hit | rate limit **or hard spend limit hit** (`project_spend_limit_exceeded`). Read the error code: show "AI is busy, try again" only for real rate limits, and "AI is unavailable right now" for the spend limit |
| 402 | not expected | n/a on OpenAI (OpenRouter: credits or key limit) |
| Rate limits in app | `ai` 20/h + `aiGlobal` 18/min | per-user hourly **and daily** caps (§5); `aiGlobal` optional |
| Data / privacy UI | "free route may log or train" | "content is sent to OpenAI; not used for training; kept up to 30 days" |

> Note on the original OpenAI spec: it said gpt-5-nano returns empty content on Chat
> Completions and required the Responses API. The official reasoning guide explains the likely
> cause (reasoning tokens use up the token cap before any visible output), and the Terra/Luna
> pages list Chat Completions as supported. Verify with one real call; do not carry that rule
> over as fact.

### Account setup (OpenAI)

1. Buy at least **$5** of credits → Build tier (5,000 RPM). **[OpenAI]**
2. Create a dedicated **project** for CodStash with its own key.
3. Set a **hard spend limit** on that project and a **spend alert** below it.
4. Optional: separate keys or projects for dev and production, so tests don't eat prod budget.

### Code and docs to update at switch time

- `src/lib/ai-client.ts` and its tests (verify the adapter on the first real call): reasoning parameter, token cap
  name, error codes including `project_spend_limit_exceeded`.
- `src/lib/rate-limit.ts`: nothing (the daily cap `aiDaily` is already in the auto-tag spec;
  `aiGlobal` stays).
- `aiErrorMessage` (wherever it ends up): new 429 sub-cases.
- `.env.example`, `vitest.config.mts`: new env vars, blanked in tests.
- `context/features/ai-auto-tag-spec.md` and `docs/ai-integration-plan.md`: model, limits, gotchas.
- `context/project-overview.md`: still says "OpenAI gpt-5-nano".
- Privacy text near the AI buttons.

---

## 8. Gaps

- Terra/Luna: `verbosity` and `temperature` support on OpenAI direct; whether `max_tokens` is
  still accepted; default value of `store` on the Responses API (not needed if Chat Completions
  is used).
- OpenAI: RPD limits (none listed), free-tier model access, credit expiry.
- OpenRouter: which OpenAI tier a plain request is routed to; how to set a per-key credit limit
  via API; per-request cost field in responses.
- Alternatives: context, max output, latency and data policy per provider (not on the fetched
  OpenRouter pages).
- Real latency and output quality of Luna vs Terra on CodStash items: needs the A/B in §6.

---

## Sources

Official:
- OpenAI, GPT-6.1 Terra model page — https://developers.openai.com/api/docs/models/gpt-6.1-terra
- OpenAI, GPT-6 Luna model page — https://developers.openai.com/api/docs/models/gpt-6-luna
- OpenAI, models — https://developers.openai.com/api/docs/models
- OpenAI, pricing — https://developers.openai.com/api/docs/pricing
- OpenAI, rate limits — https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI, your data — https://developers.openai.com/api/docs/guides/your-data
- OpenAI, reasoning — https://developers.openai.com/api/docs/guides/reasoning
- OpenAI, spend limits — https://developers.openai.com/api/docs/guides/spend-limits
- OpenAI, Introducing GPT-6.1 Terra — https://openai.com/index/introducing-gpt-6-1-terra/
- OpenRouter model pages — https://openrouter.ai/openai/gpt-6.1-terra,
  https://openrouter.ai/openai/gpt-6-luna, https://openrouter.ai/anthropic/claude-haiku-5.5,
  https://openrouter.ai/qwen/qwen3.7-flash, https://openrouter.ai/deepseek/deepseek-v4.1-flash,
  https://openrouter.ai/openai/gpt-oss-20b, https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b
- OpenRouter docs — https://openrouter.ai/docs/api/reference/limits.md,
  https://openrouter.ai/docs/guides/routing/provider-selection.md,
  https://openrouter.ai/docs/guides/privacy/logging, https://openrouter.ai/docs/faq.md,
  https://openrouter.ai/docs/features/structured-outputs

Third-party (lower trust):
- https://bleepingcomputer.com/news/artificial-intelligence/openai-launches-gpt-61-terra-with-3x-faster-ai-agents-50-percent-lower-pricing
- https://9to5mac.com/2026/10/26/openai-upgrades-chatgpt-and-codex-with-new-gpt-6-1-terra-model/
- https://mixed-news.com/en/openai-api-usage-tiers-five-to-three-build-launch-grow/
- https://benchlm.ai/models/gpt-6-1-terra, https://benchlm.ai/hosts/openrouter
- https://www.teamday.ai/blog/cheapest-openrouter-models-2026

Codebase: `src/lib/billing-plans.ts` (Pro $7/month), `src/lib/rate-limit.ts`,
`docs/ai-integration-plan.md`, `context/features/ai-auto-tag-spec.md`.

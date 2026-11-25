# AI Model Pricing Research

## Output

docs/ai-model-pricing.md

## Research

Compare OpenRouter models for CodStash's four AI features (auto-tagging, summaries, code
explanation, prompt optimization). Today the app uses the free
`nvidia/nemotron-3-ultra-550b-a55b:free` through OpenRouter. Later the plan is to buy credits on
an **OpenAI API account (direct, not OpenRouter)** and use **GPT-6.1 Terra**. Check whether it is a
sensible choice, compare it with alternatives, compare OpenAI direct with OpenRouter for the same
model, and prepare the switch from the free model to a paid one.

## Include

- GPT-6.1 Terra on OpenRouter: exact model id, input/output price per million tokens, context
  length, max output, supported parameters (`response_format` / structured outputs, `reasoning`,
  `max_tokens`), reasoning behaviour, latency/throughput, providers and data policy
- 4-6 alternatives fit for short, cheap tasks (small/fast models from OpenAI, Anthropic, Google,
  Mistral, DeepSeek, Qwen, etc. as listed on OpenRouter), same facts
- Estimated cost per request and per month for each feature, from realistic token counts
  (inputs truncated as in docs/ai-integration-plan.md §7) and a few usage scenarios
- Rate limits for paid models (vs the `:free` account-wide cap) and what changes for the
  `aiGlobal` limiter
- Data policy for paid routes (`data_collection: "deny"`, ZDR) and whether it leaves providers
- Transition checklist: what changes in `src/lib/openrouter.ts`, env vars, prompts/parsing (e.g.
  JSON mode becomes available), rate limits, tests and docs when swapping `OPENROUTER_MODEL`
- Spending controls on OpenRouter (credit limits per key, alerts)
- A recommendation, per feature if it differs

## Sources

- openrouter.ai model pages, pricing, limits, structured-outputs, provider routing and privacy docs
- Web search for GPT-6.1 Terra announcements and benchmarks (official sources first)
- docs/ai-integration-plan.md and context/features/ai-auto-tag-spec.md for the current design
- @src/lib/rate-limit.ts, @src/lib/usage-limits.ts

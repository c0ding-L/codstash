# Landing page update — roadmap v2 features

## Overview

The landing page (`src/app/page.tsx`, `src/components/home/`) still describes the MVP. Since then,
roadmap v2's sections A, B and C have shipped (`docs/roadmap-v2.md`). The page and the plan cards
should say what Cortex does today, and stop promising what it does not. Section D (sharing, PWA) is
not done and stays off the page.

## What the page says today, checked against the code

| Claim | Where | Check |
| --- | --- | --- |
| "Keep your best prompts **versioned**" | `home.features.cards.prompts` | No version history on items. Decided 2026-11-27: reword around `{{variables}}`, no versioning feature. |
| "AI summaries of long notes and **files**" | `home.ai.capabilities.summaries` | True since `0e2f0e1` (Summarize in the drawer: long notes, prompts, text files). Keep. |
| "find it in milliseconds with ⌘K" | `home.features.cards.search` | True (`CommandPalette`, ⌘K / Ctrl+K). |
| Free: 50 items, 3 collections | `billing.freeFeatures` | True (`FREE_LIMITS`). |

## What shipped and is missing from the page

| Feature | Plan | Roadmap |
| --- | --- | --- |
| Custom item types | Pro | A2 |
| Export (JSON / ZIP) | Pro | A1 |
| Import (JSON export, files, public GitHub Gists) | Free (counts against limits) | A4 |
| Collection as a context file for Claude Code, Cursor, Codex | Free | A3 |
| Recently used items | Free | A5 |
| Secret detection (warn before save and before AI) | Free | A6 |
| Streamed AI answers | Pro | A7 |
| `{{variables}}` in prompts and commands, filled on copy | Free | B |
| API tokens, REST API, MCP server | Read Free, write Pro | C1–C3 |
| CLI `cortex` | Read Free, write Pro | C4 (not published yet) |

## Requirements (proposed, pending the author's decisions below)

### Feature grid

- Go from 6 to 9 cards, so the `lg:grid-cols-3` grid stays even.
- Keep the 5 item-type cards and the search card. The prompts card is reworded around variables,
  e.g. "Keep your best prompts ready for any model, with `{{variables}}` filled on copy" (no
  versioning claim).
- Add 3 cards, e.g. **Variables** (B), **Custom types** (A2), **Import & export** (A1, A3, A4),
  or **Secret warnings** (A6) instead of one of them.
- `features` in `home-content.ts` only carries `type: ItemTypeSlug | null`, and every `null` card
  gets the `Search` icon. Add an `icon` for the cards that are not an item type.

### New "Integrations" section

- Between the AI section and pricing: the API, the MCP server (Claude Code, Cursor) and the CLI.
- A server component in the style of `AiSection`, with a small code sample (e.g. the MCP config
  or a `cortex run` session).
- Read for Free, write for Pro, said once.

### Plan cards (`billing.freeFeatures` / `proFeatures`)

- Free: add "Variables", "Context export", "API, MCP and CLI (read)".
- Pro: add "API, MCP and CLI (write)". Import is Free, so it is not listed under Pro.
- `PlanCards` is shared with Settings › Plan: the change shows there too, on purpose.

### Copy

- Pricing subtitle ("upgrade for files, images and AI"), hero subtitle, footer tagline and
  `metadata.home` reviewed so they mention the assistants (MCP, context export) and the terminal.

## Constraints

- **French:** every new or changed `home.*` / `billing.*` key goes to `fr.json` through DeepL
  with the glossary, never by hand. Expect fixes on product names (Cursor, MCP, CLI) as in C3.
- **Page conventions:** the page stays an async server page with `await connection()`; client
  components only for the leaves that need it. New tokens go in `globals.css`.
- **Production:** API, MCP and CLI depend on the `api_tokens` migration, which may not be applied
  in production yet (`docs/production-checklist.md`). The updated page ships after
  `prisma migrate deploy`.

## Testing

- No unit tests: components are not tested. Unit tests only if a utility changes.
- Playwright: the page in English and French, desktop and phone width (390 px), no horizontal
  scroll, every new section visible, the plan cards on the page and in Settings.
- `npm test`, `npm run build`, `npm run lint`.

## Out of scope

- Section D (public collections, PWA).
- `PricingPlans` still has hard-coded "Get Started" / "Get Pro" from an older i18n phase. A
  one-line fix, only if the author asks for it.
- New screenshots or illustrations beyond the existing preview components.

## Decisions (author, 2026-11-27)

1. **CLI:** shown in the Integrations section with a "Coming soon" badge, no install command.
2. **New cards:** Variables, Custom types, Import & export.
3. **Integrations:** its own section.
4. **Hero:** title kept, subtitle reworded.

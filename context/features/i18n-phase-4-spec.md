# i18n (French) — Phase 4: Homepage and AI

## Overview

Translate the public homepage and choose the language of the AI answers. Reference:
`docs/i18n-plan.md` §5.6 and §8. Requires Phase 3.

## Requirements

- **Homepage**: `src/components/home` (about 570 lines of marketing text) and its metadata, using the
  `home` namespace. Add an EN / FR toggle in the header or the footer.
- **AI** (`src/lib/ai-prompts.ts`): the system prompts stay in English.
  - **Explain** and **Description**: when `locale === "fr"`, append one line to the system prompt,
    "Write the answer in French."
  - **Optimize** keeps the language of the prompt being rewritten, and **Tags** the language of
    the content. No change for those two.
  - `src/actions/ai.ts` passes the locale (`getLocale()`) to the message builders.
  - Default choice from the plan; the author can change it before this phase.

## Testing

- `ai-prompts.test.ts`: for Explain and Description, the system prompt contains the French
  instruction in `fr` and not in `en`. Optimize and Tags do not change.
- `actions/ai.test.ts`: the locale is passed to the builders.
- In the browser: the homepage is in FR, and Explain and Description answer in French.
- `npm test`, `npm run build` and `npm run lint` pass.

## Notes

- Branch: `feature/i18n-phase-4`.

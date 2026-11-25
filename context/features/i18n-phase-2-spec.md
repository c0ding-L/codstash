# i18n (French) — Phase 2: App Pages

## Overview

Translate every signed-in page with the infrastructure from Phase 1. Reference:
`docs/i18n-plan.md` §5 and §8. Requires `i18n-phase-1-spec.md` to be merged.

## Requirements

- Pages and their components:
  - dashboard (stats, recent items, pinned items, collections)
  - item lists by type, with filters and empty states
  - the item drawer (view and edit), the create dialog, item form fields
  - collections (list, detail, card menu), favorites, profile, settings, billing, upgrade
  - Pro upsell cards
- Server components use `getTranslations`, client components use `useTranslations`. Add the new
  client namespaces to the root layout's `pick`.
- The 42 `toast(...)` calls.
- The page `metadata` exports become `generateMetadata` with the `metadata` namespace.
- The roughly 25 places that read a system type's `.name` show the translated label by slug.
  Custom types keep their name.
- Formatting (§5.4):
  - `src/lib/format.ts` `formatRelativeTime` takes the locale. FR: "à l'instant", "il y a 5 min",
    "il y a 3 j", …
  - `billing-plans.ts`: no hard-coded `en-US`. XOF stays "4 000 FCFA".
  - `profile/page.tsx` `memberSince` uses the locale.
  - `ItemDetails.tsx` uses an explicit locale, never `undefined`. That avoids a hydration
    mismatch.
- Plurals use ICU (`{count, plural, one {# élément} other {# éléments}}`), never concatenation.

## Testing

- `format.test.ts` and `billing-plans.test.ts`: add `fr` cases.
- `messages.test.ts` (parity) still passes.
- In the browser, in FR: walk every signed-in page and check that no English text is left,
  outside user content and Monaco.
- `npm test`, `npm run build` and `npm run lint` pass.

## Notes

- Action error messages are still in English. That is Phase 3.
- Branch: `feature/i18n-phase-2`.

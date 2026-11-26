# A2 — Custom item types (Pro)

## Overview

Pro users create their own item types: a name, an icon and a color, plus an optional template
that pre-fills new items. Pricing already sells "custom types" with Pro. The schema has been
ready since the start (`ItemType.userId`, `isSystem`, `@@unique([userId, slug])`), but the code
narrows everything to the seven system slugs (`ItemTypeSlug`). **That narrowing is most of the
work.** Roadmap: `docs/roadmap-v2.md` § A2.

Decided by default (confirm before implementing):
- **A custom type is a text type.** Its items have a Markdown content (the note editor) and an
  optional language. No file or URL variants.
- At most 20 custom types per user.

## Requirements

### Schema (migration `custom_item_types`, develop only)

- `ItemType.icon` already exists (a string). It holds a key of a curated icon map.
- Add `ItemType.template String?`: the Markdown that pre-fills the content of a new item of this
  type, at most 10,000 characters. Error Vault (roadmap E) is just a custom type with a template.
- No other column. `color` stays a `ColorToken`.

### One "type view" for system and custom types

- `src/lib/item-type-ui.ts`:
  - Add `CUSTOM_TYPE_ICONS`: a curated `Record<string, LucideIcon>` of about 24 icons (Bug,
    Wrench, BookOpen, Database, Server, Cloud, Lock, Rocket, Lightbulb, Box, …).
  - Add `resolveTypeView({ slug, name, icon, color, isSystem })`, which returns
    `{ slug, label, Icon, color, href, isSystem }`.
  - System types keep their icon and the translated label (`itemTypes.<slug>`).
  - **A custom type shows its name as typed, never translated** (the author's rule: user input
    stays as is).
  - An unknown icon or color falls back to `Box` and `blue`.
- Every component that narrows with `toItemTypeSlug(...)` and silently drops a custom type now
  goes through the view instead. Known call sites:
  - `AppSidebar`, `ItemCard`, `ItemRow`, `CollectionCard`, `FavoritesList`, `ItemDetails`,
    `NewItemDialog` and `CommandPalette`
  - `src/i18n/labels.ts` and `src/lib/db/profile.ts`
  - Run `grep toItemTypeSlug` again at implementation time.
- `ItemTypeSlug` stays the system-type union. Custom slugs are plain `string`s that went through
  the view.

### Prerequisite refactor: schemas out of the `"use server"` file

- `src/actions/items.ts` is a `"use server"` file, so it can export only async functions. Its
  zod schemas (`updateItemSchema`, `createItemSchema`, the link URL rule) cannot be imported
  elsewhere.
- Move them, unchanged, to `src/lib/item-schemas.ts` **as the first commit of this feature**.
  The actions import them from there, and the existing tests still pass.
- A4 (import) and C2 (REST API) validate with the same schemas.

### Routing

- `/items/[type]`: the segment is a system plural (`snippets`) as today. Otherwise it is looked
  up as **the user's custom slug**, and 404 if neither matches.
- **`items/[type]/layout.tsx` answers 404 today for any segment `itemTypeFromSegment` does not
  know**, before the page runs. The layout and `generateMetadata` in `page.tsx` need the same
  custom lookup:
  - `resolveTypeSegment(userId, segment)`, cached per request with React `cache`.
  - The layout calls `auth()` for the user id. It is already behind the proxy.
- **Reserved slugs:** every system slug and plural, and `new`, `custom`, `all`. Creating a type
  whose slug collides fails with a field error.
- `slugify(name)` (pure, tested): lowercase, ASCII (strip accents), `[a-z0-9-]`, collapse `-`,
  2–40 characters.
- The page lists the type's items with `ItemCard` (the generic card) and the existing
  pagination.

### Managing types (Settings › Item types, Pro)

- New section `#types` in `/settings`:
  - A list of custom types (icon, color, name, item count).
  - "New type", Edit and Delete.
- Dialog fields:
  - name (1–40 characters, unique per user, case-insensitive)
  - icon (grid of `CUSTOM_TYPE_ICONS`)
  - color (the seven tokens)
  - template (Markdown editor, optional)
- Renaming changes the slug, so the old URL then 404s. Accepted.
- Actions in a new `src/actions/item-types.ts`: `createItemType`, `updateItemType` and
  `deleteItemType`.
  - Each one: zod, auth, Pro gate for create and update (`canUseCustomTypes(plan)` in
    `usage-limits.ts`), owner-scoped queries in `src/lib/db/item-types.ts`.
  - Delete answers "N items still use this type" while items exist (`onDelete: Restrict`
    already enforces it in the database; catch P2003 too).
- Free users see the section with the Pro upsell.

### Creating and editing items of a custom type

- `NewItemDialog` lists the user's custom types after the system ones (a separator, and the
  custom ones only for Pro).
- Picking a custom type pre-fills the content with its template, but only while the content is
  still empty.
- `createItem` action:
  - The discriminated union gets a `custom` branch: `{ type: "custom", typeId, title,
    description, content, language, tags, collectionIds }`.
  - The server checks that `typeId` is the user's own, `isSystem: false`, and that the user is
    Pro.
- `src/lib/db/items.ts` `createItem` takes either a system slug or an owned custom `typeId`.
  The JSDoc that says "system type" is updated.
- `updateItem` keeps working: a custom item's fields are the note fields plus `language`.
- The drawer renders custom items like notes (Markdown view), with the language in the header
  when it is set.

### Sidebar

- Under the system types, a "Custom" group lists the user's custom types with their counts.
  The group is hidden when there are none.

### Account deletion with custom types

- `Item → ItemType` is `onDelete: Restrict`, and `ItemType → User` cascades. Postgres checks
  RESTRICT immediately, so deleting a user whose items still point at their own types can fail.
  It depends on the order of the cascade.
- `deleteAccount` (`src/actions/profile.ts`) already deletes the items before the user, so it
  should be fine. **Verify on develop**: delete a throwaway account that owns a custom type with
  items.
- `scripts/delete-all-users-except-demo` deletes users directly. Make it delete their items
  first, the same way.
- If deletion still fails, switch the relation to `onDelete: NoAction`, which is checked at the
  end of the statement and still blocks deleting a type with items. That change needs a
  migration.

### Pro lapse

- Existing custom types and their items stay listed, readable and editable.
- Creating a type, editing a type, and creating new items of a custom type need Pro again. The
  UI shows the Crown, and the actions check.

## Testing

- `item-type-ui.test.ts`:
  - `resolveTypeView` for a system type, a custom type, and an unknown icon or color.
  - `slugify`: accents, symbols, empty, 100 characters.
  - The reserved-slug check.
- `src/actions/item-types.test.ts`:
  - not signed in, Free → limit message
  - name too long, duplicate name, reserved slug
  - over 20 types
  - update or delete another user's type → not found
  - delete with items → error
  - happy paths
- `items.test.ts`: create with the `custom` branch: own type ok, another user's `typeId` refused,
  a system `typeId` passed as custom refused, Free refused.
- `src/lib/db/item-types.test.ts`: owner filters.
- Browser:
  - Create a "Problem" type with a template, then create an item of it.
  - Check it in the sidebar, at `/items/problem`, in the palette and on the dashboard.
  - Rename it, try to delete it while it has items, then delete it once empty.
  - Check in FR and EN.

## Notes

- Translation: new strings in `settings.types` and `itemTypes.custom*`. A custom type's own
  name is never translated.
- Search: `getSearchItems` already returns the type's name. Check that the palette shows custom
  items with their view.

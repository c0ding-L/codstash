# Item Types

The seven built-in item types in CodStash, as they exist in the code on 2026-11-06.

**Sources:** `context/project-overview.md`, `prisma/schema.prisma`, `prisma/seed.ts`,
`src/lib/item-type-ui.ts`, `src/types/item-type.ts`, `src/lib/mock-data.ts`, and the
components and queries that render types.

- **Missing source:** the research prompt names `src/lib/constants.tsx`, which does not exist
  and never has in git history. `src/lib/item-type-ui.ts` and `src/types/item-type.ts` hold
  that information instead.
- **Live data not checked:** type values come from the seed, not from a database query.
- **Inferred text:** the spec lists the types but does not define them, so the Purpose text is
  inferred from the spec's problem statement and the seed and mock content.

## Overview

| Type    | Slug      | Icon (lucide)    | Color token | Tailwind class     | ≈ Hex     | Text, file or URL |
| ------- | --------- | ---------------- | ----------- | ------------------ | --------- | ----------------- |
| Snippet | `snippet` | `Code2`          | `emerald`   | `text-emerald-400` | `#00d492` | Text              |
| Prompt  | `prompt`  | `Sparkles`       | `amber`     | `text-amber-400`   | `#ffb900` | Text              |
| Note    | `note`    | `FileText`       | `blue`      | `text-blue-400`    | `#51a2ff` | Text              |
| Command | `command` | `SquareTerminal` | `cyan`      | `text-cyan-400`    | `#00d3f2` | Text              |
| File    | `file`    | `File`           | `rose`      | `text-rose-400`    | `#ff637e` | File              |
| Image   | `image`   | `Image`          | `violet`    | `text-violet-400`  | `#a684ff` | File              |
| Link    | `link`    | `Link`           | `yellow`    | `text-yellow-400`  | `#fdc700` | URL               |

### About the colors

**Hex is not stored anywhere in the project.** `ItemType.color` holds a token such as
`"emerald"`, and `colorClasses` in `item-type-ui.ts` maps that token to a Tailwind class.
Tailwind v4 (4.3.3 here) defines those colors in OKLCH, so OKLCH is the real value:

| Token     | Actual value (`node_modules/tailwindcss/theme.css`) |
| --------- | --------------------------------------------------- |
| `emerald` | `oklch(76.5% 0.177 163.223)`                        |
| `amber`   | `oklch(82.8% 0.189 84.429)`                         |
| `blue`    | `oklch(70.7% 0.165 254.624)`                        |
| `cyan`    | `oklch(78.9% 0.154 211.53)`                         |
| `rose`    | `oklch(71.2% 0.194 13.428)`                         |
| `violet`  | `oklch(70.2% 0.183 293.541)`                        |
| `yellow`  | `oklch(85.2% 0.199 91.936)`                         |

The hex values were converted from these for reference. All seven fall slightly outside the
sRGB range and were clipped to fit, so they are approximate. Don't store hex in
`ItemType.color`: `toColorToken` would reject it and the type would lose its accent.

`context/features/item-type-card-color-handler.md` proposes a different palette
(`--snippet`, `--file` and so on, with file orange-red, image magenta and link lime). It was
never implemented: `src/app/globals.css` defines none of those tokens, and the comment on
`washClasses` in `item-type-ui.ts` explains why.

## The types

Field examples for Snippet, Prompt, Command and Link come from `prisma/seed.ts`. The seed
creates no Note, File or Image items, so those examples come only from `src/lib/mock-data.ts`,
which nothing in `src/` imports.

### Snippet

- **Purpose:** reusable code such as hooks, utilities and Dockerfiles.
- **Key fields:** `content` (the code) and `language` (`typescript`, `dockerfile`).
- **Seeded items:** 4.

### Prompt

- **Purpose:** reusable AI prompts, often with placeholders such as `{{diff}}`.
- **Key fields:** `content`. `language` is not set.
- **Seeded items:** 3.

### Note

- **Purpose:** free-form written knowledge in Markdown, such as design decisions and
  post-mortems.
- **Key fields:** `content`. `language` is not set.
- **Seeded items:** 0.

### Command

- **Purpose:** shell commands and one-liners that are worth keeping.
- **Key fields:** `content` (the command) and `language` (`bash`).
- **Seeded items:** 5.

### File

- **Purpose:** uploaded documents and assets, such as PDFs and SVGs.
- **Key fields:** `contentType: "file"`, `fileUrl`, `fileName`, `fileSize` (bytes).
- **Seeded items:** 0.

### Image

- **Purpose:** uploaded visual references, such as screenshots.
- **Key fields:** the same as File: `contentType: "file"`, `fileUrl`, `fileName`, `fileSize`.
- **Seeded items:** 0.

### Link

- **Purpose:** bookmarks to docs and articles.
- **Key fields:** `url`. `contentType` stays `"text"` and `content` stays null.
- **Seeded items:** 6.

## Text, file and URL classification

The schema has only two `contentType` values, `"text"` (the default) and `"file"`. **URL is
not a stored value.** It is a logical grouping based on which fields are filled in:

| Class | Types                            | `contentType` | Fields filled in                  |
| ----- | -------------------------------- | ------------- | --------------------------------- |
| Text  | Snippet, Prompt, Note, Command   | `"text"`      | `content`, sometimes `language`   |
| File  | File, Image                      | `"file"`      | `fileUrl`, `fileName`, `fileSize` |
| URL   | Link                             | `"text"`      | `url`                             |

Only convention enforces this. `Item` has no constraint tying a type to its fields, and no code
in `src/` reads `contentType` outside the unused mock data. The seed never sets it, so every
seeded item gets the default `"text"`.

## Shared properties

**Every item has:**

| Field                        | Notes                                                     |
| ---------------------------- | --------------------------------------------------------- |
| `title`                      | Required                                                  |
| `description`                | Optional                                                  |
| `isFavorite`, `isPinned`     | Default to `false`                                        |
| `userId`                     | Required; deleting the user deletes their items           |
| `typeId`                     | Required; a type still in use can't be deleted (Restrict) |
| `collectionId`               | Optional; deleting the collection keeps the item (SetNull)|
| `tags`                       | Many-to-many through `ItemTag`                            |
| `createdAt`, `updatedAt`     | Set automatically                                         |

**Every `ItemType` row has:** `slug`, `name`, `icon`, `color`, `isSystem` and `userId`.

- **Built-in types** have `isSystem: true` and `userId: null`. The seed upserts them on fixed
  ids such as `typ_snippet`, because NULLs don't collide in `@@unique([userId, slug])` and that
  constraint would allow duplicates.
- **Custom types** are planned for Pro users and would set `userId` to their owner.

## Display differences

**All seven types currently use the same layouts and differ only in icon and color.** Nothing
renders `content`, `language` or `url` yet, and file previews don't exist. Syntax highlighting,
the Markdown editor and the full-screen item editor are in the spec but not built.

| Where                    | What the type changes                                              | Code                  |
| ------------------------ | ------------------------------------------------------------------ | --------------------- |
| Icon and type label      | Full accent color (`text-*-400`)                                   | `colorClasses`        |
| Icon chip                | Accent at 10% behind the icon                                      | `surfaceClasses`      |
| Collection card tint     | Accent at 6% over the card                                         | `washClasses`         |
| Collection card on hover | Ring at 40%                                                        | `ringClasses`         |
| Sidebar                  | Plural label, plus a `PRO` badge on Files and Images               | `AppSidebar.tsx`      |
| Item row                 | Shows `fileSize` when it is set, which in practice means File/Image | `ItemRow.tsx`         |

- **Collection cards:** the most-used type in the collection sets the card's icon and accent,
  with ties broken by slug. Each type present also gets a small icon.
- **Icons:** the UI picks them from `typeIcons` by slug. `getItemTypes` doesn't select the
  `ItemType.icon` column, so that column has no effect on what renders.
- **Unrecognised types:** a slug or color outside the known list doesn't crash. The item row and
  collection card fall back to a `Clock` icon and no accent. The sidebar's fixed list won't show
  the type, and the profile breakdown only counts it in the total.

## Inconsistencies found

These are recorded for follow-up. Nothing was changed.

1. **Command is missing from the sidebar.** `sidebarTypes` (`src/lib/item-type-ui.ts:97`) lists
   six types without Command, although it is seeded and appears in the profile breakdown. The
   design mockup (`context/screenshots/dashboard-ui-main.png`) shows all seven, with Commands
   between Notes and Files.
2. **The specs disagree on whether Images are Pro.** `context/features/add-pro-badge-sidebar.md`
   asks for the badge on Files and Images, and `proTypeSlugs` (`src/lib/item-type-ui.ts:94`)
   follows it. The plan table in `project-overview.md` includes image uploads in the Free plan
   and lists only file uploads as Pro. The badge is only visual so far, because the app has no
   item creation or upload code to gate.
3. **Sidebar type links have no destination.** `itemTypeHref` builds `/items/<plural>` links, but
   there is no `items` route under `src/app/`.
4. **The name differs.** The spec calls the seventh type "URL", while the slug, name and UI all
   use "Link".
5. **The order differs by location:**
   - **Sidebar:** snippet, prompt, note, file, image, link.
   - **Profile:** snippet, prompt, note, command, link, file, image.
   - **`getItemTypes`:** sorted alphabetically by slug.
6. **The icon chip differs from its spec.** The code uses a 10% background, and
   `item-type-card-color-handler.md` says 15%. The spec also names `StickyNote` for notes, where
   the code uses `FileText`.

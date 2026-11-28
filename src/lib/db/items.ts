import type { Prisma } from "@/generated/prisma/client";
import { clipCommand } from "@/lib/command-text";
import { clampLimit, MAX_ITEM_LIMIT } from "@/lib/db/limits";
import {
  DASHBOARD_PINNED_ITEMS_LIMIT,
  DASHBOARD_RECENT_ITEMS_LIMIT,
  DASHBOARD_RECENTLY_USED_LIMIT,
  ITEMS_PER_PAGE,
  pageOffset,
} from "@/lib/pagination";
import { assertBelowLimit } from "@/lib/db/billing";
import { collectionLinks, sortTagNames, tagLinks, tagNames, tagNameSelect } from "@/lib/db/item-links";
import { prisma } from "@/lib/prisma";
import { countWords, estimateTokens, markdownToPlainText, promptExcerpt } from "@/lib/prompt-text";
import { searchPreview } from "@/lib/search-text";
import { snippetPreview } from "@/lib/snippet-text";
import { parseVariables } from "@/lib/template-vars";
import type { ItemTypeSlug, TypeRef } from "@/types/item-type";

/** Everything a row on the dashboard renders, flattened out of the relations. */
export interface DashboardItem {
  id: string;
  title: string;
  description: string | null;
  /** The uploaded file's original name; null for text items. */
  fileName: string | null;
  fileSize: number | null;
  /** A link item's address; free text, so check it with `isWebUrl` before linking. */
  url: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  /** Whether a public link is on (D1). The link itself is only read by the share dialog. */
  isShared: boolean;
  updatedAt: Date;
  /** `Item.typeId` is required, so every item has one. */
  type: TypeRef & { id: string };
  /** The collections the item is in, by name; empty when it is in none. */
  collections: ItemCollectionRef[];
}

export interface ItemCollectionRef {
  id: string;
  name: string;
}

/**
 * Shared shape for both reads. The type and the collections come back with the
 * items so neither section has to look them up per row.
 */
const dashboardItemSelect = {
  id: true,
  title: true,
  description: true,
  fileName: true,
  fileSize: true,
  url: true,
  isPinned: true,
  isFavorite: true,
  shareId: true,
  updatedAt: true,
  type: { select: { id: true, slug: true, name: true, icon: true, color: true, isSystem: true } },
  collections: {
    select: { collection: { select: { id: true, name: true } } },
    orderBy: { collection: { name: "asc" } },
  },
} as const;

/** What the select above returns: a `DashboardItem` with the links unflattened. */
type SelectedItem = Omit<DashboardItem, "collections" | "isShared"> & {
  shareId: string | null;
  collections: { collection: ItemCollectionRef }[];
};

function toDashboardItem(item: SelectedItem): DashboardItem {
  const { collections, shareId, ...rest } = item;
  return { ...rest, isShared: shareId !== null, collections: collections.map(({ collection }) => collection) };
}

/** Pinned items for the dashboard, newest first, 5 at most. Empty when nothing is pinned. */
export async function getPinnedItems(userId: string): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: DASHBOARD_PINNED_ITEMS_LIMIT,
    select: dashboardItemSelect,
  });

  return items.map(toDashboardItem);
}

/**
 * Favorite items for `/favorites`, most recently updated first, up to the ceiling.
 * There is no `favoritedAt`, so `updatedAt` stands in for when it was favorited.
 */
export async function getFavoriteItems(userId: string): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: { userId, isFavorite: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_ITEM_LIMIT,
    select: dashboardItemSelect,
  });

  return items.map(toDashboardItem);
}

/**
 * The most recently updated items, plus how many the user has in total — the
 * section header reads "10 of 18".
 */
export async function getRecentItems(
  userId: string,
  limit: number = DASHBOARD_RECENT_ITEMS_LIMIT,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  const [items, totalCount] = await Promise.all([
    prisma.item.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: clampLimit(limit, MAX_ITEM_LIMIT),
      select: dashboardItemSelect,
    }),
    prisma.item.count({ where: { userId } }),
  ]);

  return { items: items.map(toDashboardItem), totalCount };
}

/**
 * Items in "Recently used": the user's items they copied, downloaded or opened, latest first.
 * Pinned items are left out, since the dashboard already lists them under "Pinned items".
 */
export async function getRecentlyUsedItems(
  userId: string,
  limit: number = DASHBOARD_RECENTLY_USED_LIMIT,
): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: { userId, lastUsedAt: { not: null }, isPinned: false },
    orderBy: [{ lastUsedAt: "desc" }, { id: "asc" }],
    take: clampLimit(limit, MAX_ITEM_LIMIT),
    select: dashboardItemSelect,
  });
  return items.map(toDashboardItem);
}

/**
 * Pinned items first, favorites first within each group (so pinned + favorite leads),
 * then most recently updated, with the id as a stable tiebreaker.
 */
const pinnedFirstOrder = [
  { isPinned: "desc" },
  { isFavorite: "desc" },
  { updatedAt: "desc" },
  { id: "asc" },
] satisfies Prisma.ItemOrderByWithRelationInput[];

/**
 * One page of the user's items of one type, pinned first, then favorites, then most recently updated, plus
 * the total so the page can count its pages. A system type by its slug, a custom one by its id.
 */
export async function getItemsByType(
  userId: string,
  type: { slug: ItemTypeSlug } | { customTypeId: string },
  page: number = 1,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  return getItemsPage(userId, "slug" in type ? { type: { slug: type.slug } } : { typeId: type.customTypeId }, page);
}

/**
 * One page of the user's items in one collection, pinned first, then favorites, then most recently updated,
 * plus the total so the page can count its pages. The caller checks the
 * collection is the user's; `userId` keeps another user's items out regardless.
 */
export async function getItemsByCollection(
  userId: string,
  collectionId: string,
  page: number = 1,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  return getItemsPage(userId, { collections: { some: { collectionId } } }, page);
}

/** One page of the user's items matching `where`, plus their total. `userId` is set after `where`, so it cannot be overridden. */
async function getItemsPage(
  userId: string,
  filter: Prisma.ItemWhereInput,
  page: number,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  const where = { ...filter, userId };
  const [items, totalCount] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: pinnedFirstOrder,
      skip: pageOffset(page, ITEMS_PER_PAGE),
      take: ITEMS_PER_PAGE,
      select: dashboardItemSelect,
    }),
    prisma.item.count({ where }),
  ]);

  return { items: items.map(toDashboardItem), totalCount };
}

/**
 * An item as the command palette lists it: the drawer's card, a one-line preview
 * to show, and the rest of what the drawer shows, so the search covers it all.
 */
export interface SearchItem extends DashboardItem {
  preview: string;
  /** Last copy, download or opening; null when never used. Sorts the palette's "Recently used". */
  lastUsedAt: Date | null;
  /** The whole content, not clipped: a match deep inside it must still be found. */
  content: string | null;
  language: string | null;
  tags: string[];
}

/** `SearchItem` after a JSON round trip: the date arrives as a string. */
export type SearchItemJson = Omit<SearchItem, "updatedAt" | "lastUsedAt"> & { updatedAt: string; lastUsedAt: string | null };

/** The user's items for the command palette, most recently updated first, up to the ceiling. */
export async function getSearchItems(userId: string): Promise<SearchItem[]> {
  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_ITEM_LIMIT,
    select: {
      ...dashboardItemSelect,
      content: true,
      language: true,
      lastUsedAt: true,
      tags: tagNameSelect,
    },
  });

  return items.map(({ content, language, lastUsedAt, tags, ...item }) => ({
    ...toDashboardItem(item),
    // A custom type is Markdown, like a note.
    preview: searchPreview(content, item.type.isSystem ? item.type.slug : "note"),
    lastUsedAt,
    content,
    language,
    tags: tagNames(tags),
  }));
}

/**
 * The text of each listed command, for the command list. Kept out of
 * `DashboardItem`, which the dashboard shares and the drawer trigger receives
 * whole; a command over the cap comes back cut, and its copy button fetches it.
 * `hasVariables` is read on the whole command, so a cut one still opens the variables form.
 */
export async function getCommandTexts(
  userId: string,
  ids: string[],
): Promise<Record<string, CommandText>> {
  if (ids.length === 0) return {};

  const rows = await prisma.item.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, content: true },
  });

  return Object.fromEntries(
    rows.map(({ id, content }) => {
      const raw = content ?? "";
      return [id, { ...clipCommand(raw), hasVariables: parseVariables(raw).length > 0 }];
    }),
  );
}

/** A listed command: its text, cut past `MAX_COMMAND_CHARS`, and whether it holds variables. */
export interface CommandText {
  text: string;
  isCut: boolean;
  hasVariables: boolean;
}

/** What the prompt list shows of a prompt beyond its card. */
export interface PromptPreview {
  excerpt: string;
  /** Counted on the prompt's plain text, so Markdown marks are not words. */
  words: number;
  /** An estimate from the raw content: what would be sent to a model. */
  tokens: number;
  /** Tag names, sorted. */
  tags: string[];
  /** Distinct template variables (roadmap § B), for the card's badge and the copy button. */
  variables: number;
}

/**
 * The excerpt, counts and tags of each listed prompt. The full content is read
 * here and never sent to the list (it has no length cap); the tags of the whole
 * list come from one query.
 */
export async function getPromptPreviews(
  userId: string,
  ids: string[],
): Promise<Record<string, PromptPreview>> {
  if (ids.length === 0) return {};

  const [rows, tagsByItem] = await Promise.all([
    prisma.item.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, content: true },
    }),
    getTagsByItem(userId, ids),
  ]);

  return Object.fromEntries(
    rows.map(({ id, content }) => {
      const raw = content ?? "";
      return [
        id,
        {
          excerpt: promptExcerpt(raw),
          words: countWords(markdownToPlainText(raw)),
          tokens: estimateTokens(raw),
          tags: tagsByItem.get(id) ?? [],
          variables: parseVariables(raw).length,
        },
      ];
    }),
  );
}

/** What the snippet list shows of a snippet beyond its card. */
export interface SnippetPreview {
  /** The first lines, each capped: the list highlights this, never the full code. */
  code: string;
  /** Lines in the whole snippet. */
  lineCount: number;
  language: string | null;
  /** Tag names, sorted. */
  tags: string[];
}

/**
 * The first lines, line count, language and tags of each listed snippet. The full
 * content is read here and never sent to the list; the tags come from one query.
 */
export async function getSnippetPreviews(
  userId: string,
  ids: string[],
): Promise<Record<string, SnippetPreview>> {
  if (ids.length === 0) return {};

  const [rows, tagsByItem] = await Promise.all([
    prisma.item.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, content: true, language: true },
    }),
    getTagsByItem(userId, ids),
  ]);

  return Object.fromEntries(
    rows.map(({ id, content, language }) => [
      id,
      { ...snippetPreview(content ?? ""), language, tags: tagsByItem.get(id) ?? [] },
    ]),
  );
}

/** The sorted tag names of each of these items, in one query for the whole list. */
async function getTagsByItem(userId: string, ids: string[]): Promise<Map<string, string[]>> {
  const links = await prisma.itemTag.findMany({
    where: { itemId: { in: ids }, item: { userId } },
    select: { itemId: true, tag: { select: { name: true } } },
  });

  const tagsByItem = new Map<string, string[]>();
  for (const { itemId, tag } of links) {
    tagsByItem.set(itemId, [...(tagsByItem.get(itemId) ?? []), tag.name]);
  }
  for (const names of tagsByItem.values()) sortTagNames(names);
  return tagsByItem;
}

/**
 * What the drawer needs on top of the card, which it already has. Left out of
 * `DashboardItem` because `content` can be large and lists never show it.
 */
export interface ItemDetail {
  content: string | null;
  url: string | null;
  fileName: string | null;
  language: string | null;
  createdAt: Date;
  /** Tag names, sorted. */
  tags: string[];
}

/** An `ItemDetail` as it arrives from `/api/items/[id]`: JSON turns dates into strings. */
export type ItemDetailJson = Omit<ItemDetail, "createdAt"> & { createdAt: string };

/**
 * The item's detail, or null both when it does not exist and when it belongs to
 * someone else, so a caller cannot tell the two apart.
 *
 * Two flat queries in parallel, because each level of a nested select costs
 * Prisma another round trip: selecting the tags through the item took three.
 */
export async function getItemDetail(userId: string, id: string): Promise<ItemDetail | null> {
  const [item, tags] = await Promise.all([
    prisma.item.findFirst({
      where: { id, userId },
      select: { content: true, url: true, fileName: true, language: true, createdAt: true },
    }),
    prisma.tag.findMany({
      where: { userId, items: { some: { itemId: id } } },
      select: { name: true },
    }),
  ]);
  if (!item) return null;

  return { ...item, tags: sortTagNames(tags.map(({ name }) => name)) };
}

/** What the Explain and Optimize routes read: the item's content and its type, or null when it is not this user's. */
export interface ItemForExplain {
  content: string | null;
  language: string | null;
  /** The item type's slug, e.g. `snippet`. */
  slug: string;
}

/** The content, language and type slug of one of the user's items, for the AI explanation and optimization. */
export async function getItemForExplain(userId: string, id: string): Promise<ItemForExplain | null> {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: { content: true, language: true, type: { select: { slug: true } } },
  });
  if (!item) return null;
  return { content: item.content, language: item.language, slug: item.type.slug };
}

export interface ItemForSummary {
  title: string;
  slug: string;
  content: string | null;
  /** The R2 key of a file item. */
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
}

/** One of the user's items, with what a summary needs; null when missing or someone else's. */
export async function getItemForSummary(userId: string, id: string): Promise<ItemForSummary | null> {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: {
      title: true,
      content: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      type: { select: { slug: true, isSystem: true } },
    },
  });
  if (!item) return null;
  const { type, ...rest } = item;
  // A custom type's slug could read "note"; only the system types are summarised.
  return { ...rest, slug: type.isSystem ? type.slug : "custom" };
}

/**
 * The fields the drawer edits. An absent field is left as it is, while null
 * clears it, so a caller sends only the fields the item's type uses.
 */
export interface ItemUpdate {
  title: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  /** Replaces every tag on the item. */
  tags: string[];
  /** Replaces every collection the item is in. Must be the user's own. */
  collectionIds: string[];
}

/**
 * Updates the item and returns both halves the drawer shows: the card and the
 * detail. One `update` filtered on the owner, so another user's item throws
 * Prisma's P2025 just as a missing one does, and nothing is read beforehand.
 *
 * Tags are rewritten in the same write: every link is dropped, then each name
 * is linked to this user's tag of that name, created if they have none. The
 * collections are rewritten the same way.
 */
export async function updateItem(
  userId: string,
  id: string,
  { tags, collectionIds, ...fields }: ItemUpdate,
): Promise<{ card: DashboardItem; detail: ItemDetail }> {
  const updated = await prisma.item.update({
    where: { id, userId },
    data: {
      ...fields,
      tags: { deleteMany: {}, create: tagLinks(userId, tags) },
      collections: { deleteMany: {}, create: collectionLinks(collectionIds) },
    },
    select: savedItemSelect,
  });
  return toSavedItem(updated);
}

/**
 * Replaces the content of one of the user's prompts, for an accepted AI optimization, and returns
 * both halves the drawer shows. One `update` filtered on the owner and the prompt type, so another
 * user's item, or one that is not a prompt, throws Prisma's P2025 just as a missing one does.
 */
export async function updatePromptContent(
  userId: string,
  id: string,
  content: string,
): Promise<{ card: DashboardItem; detail: ItemDetail }> {
  const updated = await prisma.item.update({
    where: { id, userId, type: { slug: "prompt" } },
    data: { content },
    select: savedItemSelect,
  });
  return toSavedItem(updated);
}

/** What a write reads back for the drawer: the card's fields plus the detail's. */
const savedItemSelect = {
  ...dashboardItemSelect,
  content: true,
  language: true,
  createdAt: true,
  tags: tagNameSelect,
} satisfies Prisma.ItemSelect;

function toSavedItem(updated: Prisma.ItemGetPayload<{ select: typeof savedItemSelect }>): {
  card: DashboardItem;
  detail: ItemDetail;
} {
  const { content, language, createdAt, tags: links, ...card } = updated;
  return {
    card: toDashboardItem(card),
    detail: {
      content,
      url: card.url,
      fileName: card.fileName,
      language,
      createdAt,
      tags: tagNames(links),
    },
  };
}

/** The fields of a new item. Those its type does not use are left out. */
export interface ItemCreate {
  /** A system type's slug, or the id of one of the user's custom types. */
  type: ItemTypeSlug | { customTypeId: string };
  title: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  /** File and image items: the R2 key, the original name and the stored size. */
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: "text" | "file";
  tags: string[];
  /** The collections to add it to. Must be the user's own. */
  collectionIds: string[];
}

/**
 * Creates the item under the system type of that slug, or under the user's custom type of
 * that id, and returns its card. Throws when no such type exists, or when the custom type is
 * not this user's. The system lookup filters on a null owner because the `[userId, slug]`
 * unique cannot be queried with a null.
 */
export async function createItem(
  userId: string,
  { type: typeKey, tags, collectionIds, ...fields }: ItemCreate,
  /** The Free item limit, re-checked under a lock; omitted for Pro. */
  { maxItems }: { maxItems?: number } = {},
): Promise<DashboardItem> {
  const type = await prisma.itemType.findFirst({
    where:
      typeof typeKey === "string"
        ? { slug: typeKey, userId: null, isSystem: true }
        : { id: typeKey.customTypeId, userId, isSystem: false },
    select: { id: true },
  });
  if (!type) {
    throw new Error(typeof typeKey === "string" ? `No system item type "${typeKey}".` : "No such custom item type.");
  }

  const args = {
    data: {
      ...fields,
      user: { connect: { id: userId } },
      type: { connect: { id: type.id } },
      tags: { create: tagLinks(userId, tags) },
      collections: { create: collectionLinks(collectionIds) },
    },
    select: dashboardItemSelect,
  };

  const created =
    maxItems === undefined
      ? await prisma.item.create(args)
      : await prisma.$transaction(async (tx) => {
          await assertBelowLimit(tx, userId, "items", maxItems);
          return tx.item.create(args);
        });

  return toDashboardItem(created);
}

/**
 * Deletes the item and returns its R2 key, if it had a file, so the caller can
 * delete that too. Filtered on the owner, so another user's item throws
 * Prisma's P2025 just as a missing one does. Its tag and collection links
 * cascade; the tags and collections stay.
 */
export async function deleteItem(userId: string, id: string): Promise<{ fileUrl: string | null }> {
  return prisma.item.delete({ where: { id, userId }, select: { fileUrl: true } });
}

/** The stored file of one of the user's items, or null when it has none or is not theirs. */
export async function getItemFile(userId: string, id: string): Promise<{ fileUrl: string; fileName: string } | null> {
  const item = await prisma.item.findFirst({
    where: { id, userId, fileUrl: { not: null } },
    select: { fileUrl: true, fileName: true },
  });
  if (!item?.fileUrl) return null;
  return { fileUrl: item.fileUrl, fileName: item.fileName ?? "file" };
}

/** Whether one of the user's items already stores this R2 key, so the object must stay. */
export async function isFileKeyInUse(userId: string, fileKey: string): Promise<boolean> {
  const item = await prisma.item.findFirst({ where: { userId, fileUrl: fileKey }, select: { id: true } });
  return item !== null;
}

/** Every R2 key the user's items point at, for deleting the account. */
export async function getItemFileKeys(userId: string): Promise<string[]> {
  const items = await prisma.item.findMany({
    where: { userId, fileUrl: { not: null } },
    select: { fileUrl: true },
  });
  return items.flatMap(({ fileUrl }) => (fileUrl ? [fileUrl] : []));
}

/**
 * Sets one of the user's items as a favorite or not. False when it is missing or not
 * theirs. Raw SQL, because Prisma's `update` would bump `@updatedAt`: favoriting is not
 * an edit, and the recent lists sort by that column.
 */
export async function setItemFavorite(userId: string, id: string, isFavorite: boolean): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "Item" SET "isFavorite" = ${isFavorite} WHERE "id" = ${id} AND "userId" = ${userId}
  `;
  return updated > 0;
}

/** Like `setItemFavorite`: raw SQL so `@updatedAt` is not bumped and the item keeps its place in recent lists. */
/**
 * Records a use of one of the user's items (A5): a copy, a download or an opening in the
 * drawer. Raw SQL, like favorite and pin, so `@updatedAt` is not bumped and "Recent items"
 * keeps its order. Throttled in the query itself: at most one write per item every 5
 * minutes, with no read first. False when nothing was written (throttled, missing or not
 * the user's).
 */
export async function markItemUsed(userId: string, id: string): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "Item" SET "lastUsedAt" = now()
    WHERE "id" = ${id} AND "userId" = ${userId}
      AND ("lastUsedAt" IS NULL OR "lastUsedAt" < now() - interval '5 minutes')
  `;
  return updated > 0;
}

export async function setItemPinned(userId: string, id: string, isPinned: boolean): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "Item" SET "isPinned" = ${isPinned} WHERE "id" = ${id} AND "userId" = ${userId}
  `;
  return updated > 0;
}

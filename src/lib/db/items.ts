import { clampLimit, MAX_ITEM_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";
import type { ItemTypeSlug } from "@/types/item-type";

/** Everything a row on the dashboard renders, flattened out of the relations. */
export interface DashboardItem {
  id: string;
  title: string;
  description: string | null;
  fileSize: number | null;
  isPinned: boolean;
  isFavorite: boolean;
  updatedAt: Date;
  /** `Item.typeId` is required, so every item has one. */
  type: { slug: string; name: string; color: string | null };
  /** Null once a collection is deleted — `Item.collectionId` is SetNull. */
  collectionName: string | null;
}

/**
 * Shared shape for both reads. The type and the collection name come back with
 * the items so neither section has to look them up per row.
 */
const dashboardItemSelect = {
  id: true,
  title: true,
  description: true,
  fileSize: true,
  isPinned: true,
  isFavorite: true,
  updatedAt: true,
  type: { select: { slug: true, name: true, color: true } },
  collection: { select: { name: true } },
} as const;

/** What the select above returns: a `DashboardItem` with the relation unflattened. */
type SelectedItem = Omit<DashboardItem, "collectionName"> & {
  collection: { name: string } | null;
};

function toDashboardItem(item: SelectedItem): DashboardItem {
  const { collection, ...rest } = item;
  return { ...rest, collectionName: collection?.name ?? null };
}

/** Pinned items, newest first, up to the ceiling. Empty when nothing is pinned. */
export async function getPinnedItems(userId: string): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_ITEM_LIMIT,
    select: dashboardItemSelect,
  });

  return items.map(toDashboardItem);
}

/** Matches the count the section has always shown. */
const RECENT_ITEM_LIMIT = 10;

/**
 * The most recently updated items, plus how many the user has in total — the
 * section header reads "10 of 18".
 */
export async function getRecentItems(
  userId: string,
  limit: number = RECENT_ITEM_LIMIT,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  const [items, totalCount] = await Promise.all([
    prisma.item.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(limit, MAX_ITEM_LIMIT),
      select: dashboardItemSelect,
    }),
    prisma.item.count({ where: { userId } }),
  ]);

  return { items: items.map(toDashboardItem), totalCount };
}

/**
 * The user's items of one type, most recently updated first, plus the total so
 * the page can say when the ceiling cut the list short. Filters on the slug, so
 * a custom type reusing a system slug lists with it, as in the profile counts.
 */
export async function getItemsByType(
  userId: string,
  slug: ItemTypeSlug,
): Promise<{ items: DashboardItem[]; totalCount: number }> {
  const where = { userId, type: { slug } };

  const [items, totalCount] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: MAX_ITEM_LIMIT,
      select: dashboardItemSelect,
    }),
    prisma.item.count({ where }),
  ]);

  return { items: items.map(toDashboardItem), totalCount };
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
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item) return null;

  return { ...item, tags: tags.map(({ name }) => name) };
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
}

/**
 * Updates the item and returns both halves the drawer shows: the card and the
 * detail. One `update` filtered on the owner, so another user's item throws
 * Prisma's P2025 just as a missing one does, and nothing is read beforehand.
 *
 * Tags are rewritten in the same write: every link is dropped, then each name
 * is linked to this user's tag of that name, created if they have none.
 */
export async function updateItem(
  userId: string,
  id: string,
  { tags, ...fields }: ItemUpdate,
): Promise<{ card: DashboardItem; detail: ItemDetail }> {
  // A repeated name would link the same tag twice, which the join's key forbids.
  const names = [...new Set(tags)];

  const updated = await prisma.item.update({
    where: { id, userId },
    data: {
      ...fields,
      tags: {
        deleteMany: {},
        create: names.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId, name } },
              create: { name, userId },
            },
          },
        })),
      },
    },
    select: {
      ...dashboardItemSelect,
      content: true,
      url: true,
      fileName: true,
      language: true,
      createdAt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const { content, url, fileName, language, createdAt, tags: links, ...card } = updated;
  return {
    card: toDashboardItem(card),
    detail: {
      content,
      url,
      fileName,
      language,
      createdAt,
      tags: links.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b)),
    },
  };
}

/** The fields of a new item. Those its type does not use are left out. */
export interface ItemCreate {
  /** A system type's slug. */
  type: ItemTypeSlug;
  title: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  tags: string[];
}

/**
 * Creates the item under the system type of that slug and returns its card.
 * Throws when no such system type exists. The lookup filters on a null owner
 * because the `[userId, slug]` unique cannot be queried with a null.
 */
export async function createItem(
  userId: string,
  { type: slug, tags, ...fields }: ItemCreate,
): Promise<DashboardItem> {
  const type = await prisma.itemType.findFirst({
    where: { slug, userId: null, isSystem: true },
    select: { id: true },
  });
  if (!type) throw new Error(`No system item type "${slug}".`);

  // A repeated name would link the same tag twice, which the join's key forbids.
  const names = [...new Set(tags)];

  const created = await prisma.item.create({
    data: {
      ...fields,
      user: { connect: { id: userId } },
      type: { connect: { id: type.id } },
      tags: {
        create: names.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId, name } },
              create: { name, userId },
            },
          },
        })),
      },
    },
    select: dashboardItemSelect,
  });

  return toDashboardItem(created);
}

/**
 * Deletes the item. Filtered on the owner, so another user's item throws
 * Prisma's P2025 just as a missing one does. Its tag links cascade; the tags stay.
 */
export async function deleteItem(userId: string, id: string): Promise<void> {
  await prisma.item.delete({ where: { id, userId }, select: { id: true } });
}

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

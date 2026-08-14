import { prisma } from "@/lib/prisma";

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

/** Pinned items, newest first. Empty when nothing is pinned. */
export async function getPinnedItems(userId: string): Promise<DashboardItem[]> {
  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: "desc" },
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
      take: limit,
      select: dashboardItemSelect,
    }),
    prisma.item.count({ where: { userId } }),
  ]);

  return { items: items.map(toDashboardItem), totalCount };
}

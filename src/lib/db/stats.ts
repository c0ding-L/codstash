import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  totalItems: number;
  collectionCount: number;
  favoriteItemCount: number;
  favoriteCollectionCount: number;
}

/**
 * The four cards at the top of the dashboard. Counted rather than read off a
 * denormalized column, so `totalItems` and `favoriteItemCount` now describe the
 * same set of rows — the mock's two numbers were not comparable.
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [totalItems, collectionCount, favoriteItemCount, favoriteCollectionCount] =
    await Promise.all([
      prisma.item.count({ where: { userId } }),
      prisma.collection.count({ where: { userId } }),
      prisma.item.count({ where: { userId, isFavorite: true } }),
      prisma.collection.count({ where: { userId, isFavorite: true } }),
    ]);

  return { totalItems, collectionCount, favoriteItemCount, favoriteCollectionCount };
}

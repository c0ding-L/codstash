import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getDashboardStats } from "@/lib/db/stats";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: { item: { count: vi.fn() }, collection: { count: vi.fn() } },
}));

const countItems = prisma.item.count as unknown as Mock;
const countCollections = prisma.collection.count as unknown as Mock;

beforeEach(() => {
  countItems.mockResolvedValue(0);
  countCollections.mockResolvedValue(0);
});

describe("getDashboardStats", () => {
  it("counts only that user's rows", async () => {
    await getDashboardStats("user_a");

    for (const count of [countItems, countCollections]) {
      expect(count).toHaveBeenCalledTimes(2);
      expect(count).toHaveBeenCalledWith({ where: { userId: "user_a" } });
      expect(count).toHaveBeenCalledWith({ where: { userId: "user_a", isFavorite: true } });
    }
  });

  it("maps each count to its card", async () => {
    countItems.mockResolvedValueOnce(18).mockResolvedValueOnce(3);
    countCollections.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

    expect(await getDashboardStats("user_a")).toEqual({
      totalItems: 18,
      collectionCount: 5,
      favoriteItemCount: 3,
      favoriteCollectionCount: 1,
    });
  });
});

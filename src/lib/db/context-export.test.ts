import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getCollectionContextData } from "@/lib/db/context-export";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: { findUnique: vi.fn() },
    item: { findMany: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;

beforeEach(() => {
  asMock(prisma.collection.findUnique).mockResolvedValue({ name: "React", description: null });
  asMock(prisma.item.findMany).mockResolvedValue([]);
});

describe("getCollectionContextData", () => {
  it("reads the user's own collection and its items, newest first with ties broken by id", async () => {
    await expect(getCollectionContextData("user_1", "col_1")).resolves.toEqual({
      collection: { name: "React", description: null },
      items: [],
    });

    expect(asMock(prisma.collection.findUnique).mock.calls[0]![0].where).toEqual({ id: "col_1", userId: "user_1" });
    expect(asMock(prisma.item.findMany).mock.calls[0]![0]).toMatchObject({
      where: { userId: "user_1", collections: { some: { collectionId: "col_1" } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  });

  it("is null for a collection that is missing or someone else's, reading no item", async () => {
    asMock(prisma.collection.findUnique).mockResolvedValue(null);

    await expect(getCollectionContextData("user_1", "col_x")).resolves.toBeNull();
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});

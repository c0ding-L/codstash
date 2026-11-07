import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getItemsByType, getPinnedItems, getRecentItems } from "@/lib/db/items";
import { MAX_ITEM_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { item: { findMany: vi.fn(), count: vi.fn() } } }));

const findMany = prisma.item.findMany as unknown as Mock;
const count = prisma.item.count as unknown as Mock;

const USER = "user_a";

beforeEach(() => {
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
});

describe("account isolation", () => {
  it.each([
    ["getPinnedItems", () => getPinnedItems(USER), { userId: USER, isPinned: true }],
    ["getRecentItems", () => getRecentItems(USER), { userId: USER }],
    ["getItemsByType", () => getItemsByType(USER, "snippet"), { userId: USER, type: { slug: "snippet" } }],
  ])("%s reads only that user's items", async (_name, read, where) => {
    await read();

    expect(findMany.mock.calls[0]![0].where).toEqual(where);
  });

  it.each([
    ["getRecentItems", () => getRecentItems(USER), { userId: USER }],
    ["getItemsByType", () => getItemsByType(USER, "note"), { userId: USER, type: { slug: "note" } }],
  ])("%s counts only that user's items", async (_name, read, where) => {
    await read();

    expect(count).toHaveBeenCalledWith({ where });
  });
});

describe("getItemsByType", () => {
  it("reads the newest first, up to the ceiling, and reports the full total", async () => {
    count.mockResolvedValue(250);

    const { totalCount } = await getItemsByType(USER, "link");

    expect(totalCount).toBe(250);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ orderBy: { updatedAt: "desc" }, take: MAX_ITEM_LIMIT });
  });

  it("flattens the collection name, and is null once the collection is gone", async () => {
    findMany.mockResolvedValue([
      { id: "a", collection: { name: "DevOps" } },
      { id: "b", collection: null },
    ]);

    const { items } = await getItemsByType(USER, "link");

    expect(items.map(({ collectionName }) => collectionName)).toEqual(["DevOps", null]);
    expect(items[0]).not.toHaveProperty("collection");
  });
});

describe("getRecentItems", () => {
  it("clamps a limit above the ceiling", async () => {
    await getRecentItems(USER, MAX_ITEM_LIMIT + 1);

    expect(findMany.mock.calls[0]![0].take).toBe(MAX_ITEM_LIMIT);
  });

  it("rejects a negative limit, which Prisma would read backwards", async () => {
    await expect(getRecentItems(USER, -5)).rejects.toThrow(RangeError);
    expect(findMany).not.toHaveBeenCalled();
  });
});

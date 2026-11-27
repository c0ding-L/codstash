import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { exportItemPages, getExportHeaderData } from "@/lib/db/export";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    itemType: { findMany: vi.fn() },
    collection: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;

function dbRow(id: string) {
  return {
    id,
    title: id,
    tags: [{ tag: { name: "a" } }, { tag: { name: "b" } }],
    collections: [{ collectionId: "col_1" }],
  };
}

async function collect<T>(pages: AsyncIterable<T[]>) {
  const all: T[][] = [];
  for await (const page of pages) all.push(page);
  return all;
}

describe("getExportHeaderData", () => {
  beforeEach(() => {
    asMock(prisma.user.findUnique).mockResolvedValue({ name: "Demo", email: "d@example.com", locale: null });
    asMock(prisma.itemType.findMany).mockResolvedValue([]);
    asMock(prisma.collection.findMany).mockResolvedValue([]);
  });

  it("reads only the user's own types and collections", async () => {
    await getExportHeaderData("user_1");

    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user_1" } }));
    expect(prisma.itemType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1", isSystem: false } }),
    );
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("is null without a user row", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue(null);
    expect(await getExportHeaderData("user_1")).toBeNull();
  });
});

describe("exportItemPages", () => {
  it("pages by id after the last one, filtered on the owner, and flattens the relations", async () => {
    asMock(prisma.item.findMany)
      .mockResolvedValueOnce([dbRow("a"), dbRow("b")])
      .mockResolvedValueOnce([dbRow("c")]);

    const pages = await collect(exportItemPages("user_1", 2));

    expect(pages.map((page) => page.map((item) => item.id))).toEqual([["a", "b"], ["c"]]);
    expect(pages[0]![0]).toMatchObject({ tags: ["a", "b"], collectionIds: ["col_1"] });
    const calls = asMock(prisma.item.findMany).mock.calls.map(([args]) => args);
    expect(calls[0]).toMatchObject({ where: { userId: "user_1" }, take: 2, orderBy: { id: "asc" } });
    expect(calls[0].where).not.toHaveProperty("id");
    expect(calls[1]).toMatchObject({ where: { userId: "user_1", id: { gt: "b" } } });
    // A short page is the last: no third query.
    expect(calls).toHaveLength(2);
  });

  it("stops on an empty page", async () => {
    asMock(prisma.item.findMany).mockResolvedValueOnce([dbRow("a"), dbRow("b")]).mockResolvedValueOnce([]);

    const pages = await collect(exportItemPages("user_1", 2));

    expect(pages).toHaveLength(1);
    expect(prisma.item.findMany).toHaveBeenCalledTimes(2);
  });
});

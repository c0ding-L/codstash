import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  aggregateCollectionTypes,
  createCollection,
  deleteCollection,
  getCollection,
  getCollections,
  getCollectionsPage,
  getFavoriteCollectionCards,
  getCollectionOptions,
  ownsCollections,
  getFavoriteCollections,
  getItemTypes,
  getRecentCollections,
  getSidebarRecentCollections,
  updateCollection,
} from "@/lib/db/collections";
import { MAX_COLLECTION_LIMIT } from "@/lib/db/limits";
import { COLLECTIONS_PER_PAGE, DASHBOARD_COLLECTIONS_LIMIT } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    collection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    item: { delete: vi.fn(), deleteMany: vi.fn() },
    itemCollection: { deleteMany: vi.fn() },
    itemType: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const findCollections = asMock(prisma.collection.findMany);
const groupItems = asMock(prisma.$queryRaw);

/** The values bound into the type-count query: the user, then the collection ids. */
function boundValues() {
  const [, userId, ids] = groupItems.mock.calls[0]! as [unknown, string, { values: unknown[] }];
  return { userId, ids: ids.values };
}
const findTypes = asMock(prisma.itemType.findMany);

const USER = "user_a";

const SNIPPET = { id: "typ_snippet", slug: "snippet", name: "Snippet", color: "emerald" };
const LINK = { id: "typ_link", slug: "link", name: "Link", color: "lime" };
const COLLECTION = {
  id: "col_1",
  name: "DevOps",
  description: null,
  isFavorite: false,
  updatedAt: new Date(0),
  _count: { items: 3 },
};

beforeEach(() => {
  findCollections.mockResolvedValue([COLLECTION]);
  groupItems.mockResolvedValue([]);
  findTypes.mockResolvedValue([SNIPPET, LINK]);
});

describe("account isolation", () => {
  it("getItemTypes reads system types and that user's own, not other users'", async () => {
    await getItemTypes(USER);

    expect(findTypes.mock.calls[0]![0].where).toEqual({ OR: [{ userId: null }, { userId: USER }] });
  });

  it.each([
    ["getFavoriteCollections", () => getFavoriteCollections(USER), { userId: USER, isFavorite: true }],
    ["getSidebarRecentCollections", () => getSidebarRecentCollections(USER), { userId: USER }],
    ["getRecentCollections", () => getRecentCollections(USER), { userId: USER }],
    ["getCollectionsPage", () => getCollectionsPage(USER), { userId: USER }],
    ["getFavoriteCollectionCards", () => getFavoriteCollectionCards(USER), { userId: USER, isFavorite: true }],
  ])("%s reads only that user's collections and their items", async (_name, read, where) => {
    await read();

    expect(findCollections.mock.calls[0]![0].where).toEqual(where);
    expect(boundValues()).toEqual({ userId: USER, ids: ["col_1"] });
  });
});

describe("getRecentCollections", () => {
  it("returns the counts with their types, most used first", async () => {
    groupItems.mockResolvedValue([
      // Postgres counts come back as bigint.
      { collectionId: "col_1", typeId: "typ_snippet", count: BigInt(1) },
      { collectionId: "col_1", typeId: "typ_link", count: BigInt(2) },
    ]);

    const [collection] = await getRecentCollections(USER);

    expect(collection?.itemCount).toBe(3);
    expect(collection?.types.map(({ slug, count }) => [slug, count])).toEqual([
      ["link", 2],
      ["snippet", 1],
    ]);
  });

  it("gives an empty collection no types", async () => {
    const [collection] = await getRecentCollections(USER);

    expect(collection?.types).toEqual([]);
  });

  it("skips the item query when there are no collections", async () => {
    findCollections.mockResolvedValue([]);

    expect(await getRecentCollections(USER)).toEqual([]);
    expect(groupItems).not.toHaveBeenCalled();
  });

  it("reads the dashboard's count by default", async () => {
    await getRecentCollections(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({ skip: 0, take: DASHBOARD_COLLECTIONS_LIMIT });
  });

  it("clamps a limit above the ceiling", async () => {
    findCollections.mockResolvedValue([]);

    await getRecentCollections(USER, MAX_COLLECTION_LIMIT + 1);

    expect(findCollections.mock.calls[0]![0].take).toBe(MAX_COLLECTION_LIMIT);
  });
});

describe("getFavoriteCollectionCards", () => {
  it("reads the favorite collections, newest first, up to the ceiling, with their counts", async () => {
    groupItems.mockResolvedValue([{ collectionId: "col_1", typeId: "typ_link", count: BigInt(2) }]);

    const [collection] = await getFavoriteCollectionCards(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER, isFavorite: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: MAX_COLLECTION_LIMIT,
    });
    expect(collection?.types.map(({ slug }) => slug)).toEqual(["link"]);
  });
});

describe("getCollections", () => {
  it("reads every collection the user owns, newest first, up to the ceiling", async () => {
    const collections = await getCollections(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: MAX_COLLECTION_LIMIT,
    });
    expect(collections.map((collection) => collection.id)).toEqual(["col_1"]);
  });
});

describe("getCollectionsPage", () => {
  const countCollections = asMock(prisma.collection.count);

  beforeEach(() => {
    countCollections.mockResolvedValue(20);
  });

  it("reads the first page, newest first, and counts only that user's collections", async () => {
    const { collections, totalCount } = await getCollectionsPage(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: COLLECTIONS_PER_PAGE,
    });
    expect(countCollections).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(totalCount).toBe(20);
    expect(collections.map((collection) => collection.id)).toEqual(["col_1"]);
  });

  it("reads only the rows of the page asked for", async () => {
    await getCollectionsPage(USER, 3);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      skip: 2 * COLLECTIONS_PER_PAGE,
      take: COLLECTIONS_PER_PAGE,
    });
  });

  it("rejects page 0 before querying", async () => {
    await expect(getCollectionsPage(USER, 0)).rejects.toThrow(RangeError);
    expect(findCollections).not.toHaveBeenCalled();
  });
});

describe("getCollection", () => {
  const findCollection = asMock(prisma.collection.findFirst);

  it("looks the collection up by id and owner, so another user's is not found", async () => {
    findCollection.mockResolvedValue(null);

    expect(await getCollection(USER, "col_other")).toBeNull();
    expect(findCollection.mock.calls[0]![0].where).toEqual({ id: "col_other", userId: USER });
  });

  it("returns the collection's name, description and favorite flag", async () => {
    const row = { id: "col_1", name: "DevOps", description: "Infra notes", isFavorite: true };
    findCollection.mockResolvedValue(row);

    expect(await getCollection(USER, "col_1")).toEqual(row);
  });
});

describe("updateCollection", () => {
  const update = asMock(prisma.collection.update);

  it("updates only the owner's collection and stores a missing description as null", async () => {
    const row = { id: "col_1", name: "Ops", description: null, isFavorite: false };
    update.mockResolvedValue(row);

    expect(await updateCollection(USER, "col_1", { name: "Ops" })).toEqual(row);
    expect(update).toHaveBeenCalledWith({
      where: { id: "col_1", userId: USER },
      data: { name: "Ops", description: null },
      select: { id: true, name: true, description: true, isFavorite: true },
    });
  });
});

describe("deleteCollection", () => {
  const remove = asMock(prisma.collection.delete);

  it("deletes only the owner's collection and leaves its items alone", async () => {
    remove.mockResolvedValue({ id: "col_1" });

    await deleteCollection(USER, "col_1");

    expect(remove).toHaveBeenCalledWith({ where: { id: "col_1", userId: USER }, select: { id: true } });
    // The links go by cascade; nothing here touches items or their join rows.
    expect(prisma.item.delete).not.toHaveBeenCalled();
    expect(prisma.item.deleteMany).not.toHaveBeenCalled();
    expect(prisma.itemCollection.deleteMany).not.toHaveBeenCalled();
  });
});

describe("aggregateCollectionTypes", () => {
  const lookup = new Map([SNIPPET, LINK].map((type) => [type.id, type]));

  // Otherwise a card's accent could flip between renders.
  it("breaks a tie on the slug", () => {
    const types = aggregateCollectionTypes(
      [
        { typeId: "typ_snippet", count: 2 },
        { typeId: "typ_link", count: 2 },
      ],
      lookup,
    );

    expect(types.map(({ slug }) => slug)).toEqual(["link", "snippet"]);
  });

  it("drops a type missing from the lookup, such as another user's custom type", () => {
    const types = aggregateCollectionTypes(
      [
        { typeId: "someone_elses", count: 9 },
        { typeId: "typ_link", count: 1 },
      ],
      lookup,
    );

    expect(types.map(({ slug }) => slug)).toEqual(["link"]);
  });
});

describe("createCollection", () => {
  const createRow = asMock(prisma.collection.create);

  it("creates the collection for the user and returns an empty card", async () => {
    const row = { id: "col_1", name: "React", description: null, isFavorite: false, updatedAt: new Date(1) };
    createRow.mockResolvedValue(row);

    await expect(createCollection(USER, { name: "React" })).resolves.toEqual({ ...row, itemCount: 0, types: [] });
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "React", description: null, user: { connect: { id: USER } } },
      }),
    );
  });
});

describe("getCollectionOptions", () => {
  it("lists only that user's collections, by name", async () => {
    await getCollectionOptions(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: MAX_COLLECTION_LIMIT,
    });
  });
});

describe("ownsCollections", () => {
  const countRows = asMock(prisma.collection.count);

  it("is true when every distinct id is one of the user's", async () => {
    countRows.mockResolvedValue(2);

    await expect(ownsCollections(USER, ["a", "b", "a"])).resolves.toBe(true);
    expect(countRows.mock.calls[0]![0].where).toEqual({ userId: USER, id: { in: ["a", "b"] } });
  });

  it("is false when any id is not the user's", async () => {
    countRows.mockResolvedValue(1);

    await expect(ownsCollections(USER, ["mine", "theirs"])).resolves.toBe(false);
  });

  it("does not query for no ids", async () => {
    await expect(ownsCollections(USER, [])).resolves.toBe(true);
    expect(countRows).not.toHaveBeenCalled();
  });
});

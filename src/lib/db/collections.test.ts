import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  aggregateCollectionTypes,
  createCollection,
  getCollection,
  getCollections,
  getCollectionOptions,
  ownsCollections,
  getFavoriteCollections,
  getItemTypes,
  getRecentCollections,
  getSidebarRecentCollections,
} from "@/lib/db/collections";
import { MAX_COLLECTION_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    collection: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
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

  it("clamps a limit above the ceiling", async () => {
    findCollections.mockResolvedValue([]);

    await getRecentCollections(USER, MAX_COLLECTION_LIMIT + 1);

    expect(findCollections.mock.calls[0]![0].take).toBe(MAX_COLLECTION_LIMIT);
  });
});

describe("getCollections", () => {
  it("reads every collection the user owns, newest first, up to the ceiling", async () => {
    const collections = await getCollections(USER);

    expect(findCollections.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER },
      orderBy: { updatedAt: "desc" },
      take: MAX_COLLECTION_LIMIT,
    });
    expect(collections.map((collection) => collection.id)).toEqual(["col_1"]);
  });
});

describe("getCollection", () => {
  const findCollection = asMock(prisma.collection.findFirst);

  it("looks the collection up by id and owner, so another user's is not found", async () => {
    findCollection.mockResolvedValue(null);

    expect(await getCollection(USER, "col_other")).toBeNull();
    expect(findCollection.mock.calls[0]![0].where).toEqual({ id: "col_other", userId: USER });
  });

  it("returns the collection's name and description", async () => {
    const row = { id: "col_1", name: "DevOps", description: "Infra notes" };
    findCollection.mockResolvedValue(row);

    expect(await getCollection(USER, "col_1")).toEqual(row);
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

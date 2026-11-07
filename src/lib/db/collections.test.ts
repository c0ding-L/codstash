import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  aggregateCollectionTypes,
  getFavoriteCollections,
  getItemTypes,
  getRecentCollections,
  getSidebarRecentCollections,
} from "@/lib/db/collections";
import { MAX_COLLECTION_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: { findMany: vi.fn() },
    item: { groupBy: vi.fn() },
    itemType: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const findCollections = asMock(prisma.collection.findMany);
const groupItems = asMock(prisma.item.groupBy);
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
    expect(groupItems.mock.calls[0]![0].where).toEqual({ userId: USER, collectionId: { in: ["col_1"] } });
  });
});

describe("getRecentCollections", () => {
  it("returns the counts with their types, most used first", async () => {
    groupItems.mockResolvedValue([
      { collectionId: "col_1", typeId: "typ_snippet", _count: { _all: 1 } },
      { collectionId: "col_1", typeId: "typ_link", _count: { _all: 2 } },
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

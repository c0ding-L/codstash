import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getPlanStatus } from "@/lib/db/billing";
import {
  API_ITEMS_DEFAULT_LIMIT,
  API_ITEMS_MAX_LIMIT,
  API_PREVIEW_CHARS,
  buildItemsWhere,
  decodeCursor,
  encodeCursor,
  fieldsForType,
  findCustomTypeIdBySlug,
  getApiItem,
  getApiItemType,
  getApiMe,
  listApiCollections,
  listApiItems,
  patchApiItem,
} from "@/lib/db/api-items";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    itemType: { findFirst: vi.fn() },
    collection: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const findMany = asMock(prisma.item.findMany);
const findFirst = asMock(prisma.item.findFirst);
const update = asMock(prisma.item.update);

const USER_ID = "user_1";
const UPDATED = new Date("2026-11-20T10:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "item_1",
    title: "Sum",
    description: null,
    content: "a + b",
    url: null,
    language: "ts",
    fileName: null,
    fileSize: null,
    isFavorite: false,
    isPinned: false,
    createdAt: UPDATED,
    updatedAt: UPDATED,
    type: { id: "t1", slug: "snippet", name: "Snippet", isSystem: true },
    tags: [{ tag: { name: "math" } }, { tag: { name: "js" } }],
    collections: [{ collection: { id: "c1", name: "Utils" } }],
    ...overrides,
  };
}

beforeEach(() => {
  findMany.mockResolvedValue([]);
});

describe("cursor", () => {
  it("round-trips through an opaque base64url string", () => {
    const cursor = encodeCursor({ updatedAt: UPDATED, id: "item_9" });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ updatedAt: UPDATED, id: "item_9" });
  });

  it.each([
    ["not base64 JSON", "%%%"],
    ["JSON of the wrong shape", Buffer.from(JSON.stringify({ x: 1 })).toString("base64url")],
    ["a bad date", Buffer.from(JSON.stringify({ u: "never", i: "a" })).toString("base64url")],
    ["an empty id", Buffer.from(JSON.stringify({ u: UPDATED.toISOString(), i: "" })).toString("base64url")],
    ["null", Buffer.from("null").toString("base64url")],
  ])("is null for %s", (_label, value) => {
    expect(decodeCursor(value)).toBeNull();
  });
});

describe("buildItemsWhere", () => {
  it("is the owner alone without filters", () => {
    expect(buildItemsWhere(USER_ID, {})).toEqual({ userId: USER_ID });
  });

  it("matches q in title, description or content, case-insensitive, or as an exact tag", () => {
    const where = buildItemsWhere(USER_ID, { q: "Hook" });
    const contains = { contains: "Hook", mode: "insensitive" };
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: contains },
            { description: contains },
            { content: contains },
            { tags: { some: { tag: { name: "Hook" } } } },
          ],
        },
      ],
      userId: USER_ID,
    });
  });

  it("keeps q and the cursor as separate ORs, with every filter", () => {
    const where = buildItemsWhere(USER_ID, {
      q: "x",
      type: "snippet",
      tag: "react",
      collection: "c1",
      idSuffix: "abcd1234",
      cursor: { updatedAt: UPDATED, id: "item_5" },
    });
    expect(where.userId).toBe(USER_ID);
    expect(where.AND).toHaveLength(6);
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { type: { slug: "snippet" } },
        { tags: { some: { tag: { name: "react" } } } },
        { collections: { some: { collectionId: "c1" } } },
        { id: { endsWith: "abcd1234" } },
        { OR: [{ updatedAt: { lt: UPDATED } }, { updatedAt: UPDATED, id: { lt: "item_5" } }] },
      ]),
    );
  });
});

describe("listApiItems", () => {
  it("scopes to the owner, orders by updatedAt then id, and asks for one extra row", async () => {
    await listApiItems(USER_ID, {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: API_ITEMS_DEFAULT_LIMIT + 1,
      }),
    );
  });

  it("clamps the limit to the maximum", async () => {
    await listApiItems(USER_ID, { limit: 500 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: API_ITEMS_MAX_LIMIT + 1 }));
  });

  it("never selects the R2 key", async () => {
    await listApiItems(USER_ID, {});
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty("fileUrl");
  });

  it("returns a cursor to the last item when another page follows", async () => {
    findMany.mockResolvedValue([row({ id: "a" }), row({ id: "b" }), row({ id: "c" })]);

    const { items, nextCursor } = await listApiItems(USER_ID, { limit: 2 });

    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(decodeCursor(nextCursor!)).toEqual({ updatedAt: UPDATED, id: "b" });
  });

  it("has a null cursor on the last page", async () => {
    findMany.mockResolvedValue([row()]);
    expect((await listApiItems(USER_ID, { limit: 2 })).nextCursor).toBeNull();
  });

  it("cuts long content and flags it, and leaves short content whole", async () => {
    const long = "x".repeat(API_PREVIEW_CHARS + 1);
    findMany.mockResolvedValue([row({ id: "long", content: long }), row({ id: "short" }), row({ id: "none", content: null })]);

    const { items } = await listApiItems(USER_ID, {});

    expect(items[0]).toMatchObject({ content: long.slice(0, API_PREVIEW_CHARS), truncated: true });
    expect(items[1]).toMatchObject({ content: "a + b", truncated: false });
    expect(items[2]).toMatchObject({ content: null, truncated: false });
  });
});

describe("getApiItem", () => {
  it("scopes to the owner and flattens tags (sorted), collections and the file", async () => {
    findFirst.mockResolvedValue(row({ fileName: "a.pdf", fileSize: 42 }));

    const item = await getApiItem(USER_ID, "item_1");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "item_1", userId: USER_ID } }));
    expect(item).toMatchObject({
      tags: ["js", "math"],
      collections: [{ id: "c1", name: "Utils" }],
      file: { name: "a.pdf", size: 42 },
    });
    expect(item).not.toHaveProperty("fileName");
  });

  it("has a null file for a text item, and null for another user's item", async () => {
    findFirst.mockResolvedValueOnce(row());
    expect((await getApiItem(USER_ID, "item_1"))?.file).toBeNull();

    findFirst.mockResolvedValueOnce(null);
    expect(await getApiItem(USER_ID, "other")).toBeNull();
  });
});

describe("getApiItemType and fieldsForType", () => {
  it("reads the type of the owner's item only", async () => {
    findFirst.mockResolvedValue({ type: { slug: "link", isSystem: true } });
    expect(await getApiItemType(USER_ID, "item_1")).toEqual({ slug: "link", isSystem: true });
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "item_1", userId: USER_ID });
  });

  it("lists the fields each type uses", () => {
    expect(fieldsForType({ slug: "snippet", isSystem: true })).toEqual(["content", "language"]);
    expect(fieldsForType({ slug: "link", isSystem: true })).toEqual(["url"]);
    expect(fieldsForType({ slug: "file", isSystem: true })).toEqual([]);
    expect(fieldsForType({ slug: "recipes", isSystem: false })).toEqual(["content", "language"]);
  });
});

describe("patchApiItem", () => {
  beforeEach(() => update.mockResolvedValue(row()));

  it("updates only the given fields, filtered on the owner", async () => {
    await patchApiItem(USER_ID, "item_1", { title: "New" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item_1", userId: USER_ID }, data: { title: "New" } }),
    );
  });

  it("rewrites tags and collections when sent, each once", async () => {
    await patchApiItem(USER_ID, "item_1", { tags: ["a", "a"], collectionIds: ["c1"] });

    const { data } = update.mock.calls[0][0];
    expect(data.tags.deleteMany).toEqual({});
    expect(data.tags.create).toHaveLength(1);
    expect(data.tags.create[0].tag.connectOrCreate.where).toEqual({ userId_name: { userId: USER_ID, name: "a" } });
    expect(data.collections).toEqual({ deleteMany: {}, create: [{ collection: { connect: { id: "c1" } } }] });
  });
});

describe("findCustomTypeIdBySlug", () => {
  it("looks among the owner's custom types only", async () => {
    asMock(prisma.itemType.findFirst).mockResolvedValue({ id: "t9" });
    expect(await findCustomTypeIdBySlug(USER_ID, "recipes")).toBe("t9");
    expect(asMock(prisma.itemType.findFirst).mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      slug: "recipes",
      isSystem: false,
    });
  });
});

describe("listApiCollections", () => {
  it("scopes to the owner and flattens the item count", async () => {
    asMock(prisma.collection.findMany).mockResolvedValue([
      { id: "c1", name: "Utils", description: null, _count: { items: 3 } },
    ]);

    expect(await listApiCollections(USER_ID)).toEqual([{ id: "c1", name: "Utils", description: null, itemCount: 3 }]);
    expect(asMock(prisma.collection.findMany).mock.calls[0][0].where).toEqual({ userId: USER_ID });
  });
});

describe("getApiMe", () => {
  const user = { id: USER_ID, name: "Ada", email: "ada@example.com" };

  it("gives Free caps", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue(user);
    asMock(getPlanStatus).mockResolvedValue({ isPro: false, proUntil: null, items: 7, collections: 1 });

    expect(await getApiMe(USER_ID)).toEqual({
      ...user,
      isPro: false,
      proUntil: null,
      limits: { items: { used: 7, max: 50 }, collections: { used: 1, max: 3 } },
    });
  });

  it("has no caps on Pro, and is null when the account is gone", async () => {
    const proUntil = new Date("2027-01-01");
    asMock(prisma.user.findUnique).mockResolvedValueOnce(user);
    asMock(getPlanStatus).mockResolvedValue({ isPro: true, proUntil, items: 70, collections: 9 });
    expect((await getApiMe(USER_ID))?.limits).toEqual({ items: { used: 70, max: null }, collections: { used: 9, max: null } });

    asMock(prisma.user.findUnique).mockResolvedValueOnce(null);
    expect(await getApiMe(USER_ID)).toBeNull();
  });
});

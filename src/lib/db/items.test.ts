import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { MAX_COMMAND_CHARS } from "@/lib/command-text";
import {
  createItem,
  deleteItem,
  getCommandTexts,
  getItemDetail,
  getItemFile,
  getItemFileKeys,
  getItemForExplain,
  getItemsByCollection,
  getItemsByType,
  getFavoriteItems,
  getPinnedItems,
  getPromptPreviews,
  getSnippetPreviews,
  getRecentItems,
  getRecentlyUsedItems,
  getSearchItems,
  isFileKeyInUse,
  markItemUsed,
  setItemFavorite,
  setItemPinned,
  updateItem,
  updatePromptContent,
} from "@/lib/db/items";
import { assertBelowLimit } from "@/lib/db/billing";
import { MAX_ITEM_LIMIT } from "@/lib/db/limits";
import {
  DASHBOARD_PINNED_ITEMS_LIMIT,
  DASHBOARD_RECENT_ITEMS_LIMIT,
  DASHBOARD_RECENTLY_USED_LIMIT,
  ITEMS_PER_PAGE,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/db/billing", () => ({ assertBelowLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    item: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itemType: { findFirst: vi.fn() },
    tag: { findMany: vi.fn() },
    itemTag: { findMany: vi.fn() },
  },
}));

const findMany = prisma.item.findMany as unknown as Mock;
const findFirst = prisma.item.findFirst as unknown as Mock;
const count = prisma.item.count as unknown as Mock;
const findTags = prisma.tag.findMany as unknown as Mock;
const findItemTags = prisma.itemTag.findMany as unknown as Mock;
const update = prisma.item.update as unknown as Mock;
const remove = prisma.item.delete as unknown as Mock;
const create = prisma.item.create as unknown as Mock;
const asMock = (fn: unknown) => fn as Mock;
const findType = prisma.itemType.findFirst as unknown as Mock;

const USER = "user_a";

beforeEach(() => {
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
  findFirst.mockResolvedValue(null);
  findTags.mockResolvedValue([]);
  findItemTags.mockResolvedValue([]);
});

describe("account isolation", () => {
  it.each([
    ["getPinnedItems", () => getPinnedItems(USER), { userId: USER, isPinned: true }],
    ["getFavoriteItems", () => getFavoriteItems(USER), { userId: USER, isFavorite: true }],
    ["getRecentItems", () => getRecentItems(USER), { userId: USER }],
    ["getSearchItems", () => getSearchItems(USER), { userId: USER }],
    ["getItemsByType", () => getItemsByType(USER, { slug: "snippet" }), { userId: USER, type: { slug: "snippet" } }],
    [
      "getItemsByType (custom)",
      () => getItemsByType(USER, { customTypeId: "typ_custom" }),
      { userId: USER, typeId: "typ_custom" },
    ],
    [
      "getItemsByCollection",
      () => getItemsByCollection(USER, "col_1"),
      { userId: USER, collections: { some: { collectionId: "col_1" } } },
    ],
  ])("%s reads only that user's items", async (_name, read, where) => {
    await read();

    expect(findMany.mock.calls[0]![0].where).toEqual(where);
  });

  it.each([
    ["getRecentItems", () => getRecentItems(USER), { userId: USER }],
    ["getItemsByType", () => getItemsByType(USER, { slug: "note" }), { userId: USER, type: { slug: "note" } }],
    [
      "getItemsByCollection",
      () => getItemsByCollection(USER, "col_1"),
      { userId: USER, collections: { some: { collectionId: "col_1" } } },
    ],
  ])("%s counts only that user's items", async (_name, read, where) => {
    await read();

    expect(count).toHaveBeenCalledWith({ where });
  });
});

describe("getSearchItems", () => {
  it("reads the newest first, up to the ceiling", async () => {
    await getSearchItems(USER);

    expect(findMany.mock.calls[0]![0]).toMatchObject({ orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: MAX_ITEM_LIMIT });
  });

  it("returns the whole content and a clipped preview, the tags, and the collections flattened", async () => {
    const content = "# Heading\n\n" + "word ".repeat(100) + "needle";
    findMany.mockResolvedValue([
      {
        id: "a",
        content,
        language: null,
        type: { slug: "prompt", name: "Prompt", icon: null, color: "amber", isSystem: true },
        collections: [{ collection: { id: "col_1", name: "AI" } }],
        tags: [{ tag: { name: "llm" } }, { tag: { name: "review" } }],
      },
    ]);

    const [item] = await getSearchItems(USER);

    expect(item!.content).toBe(content);
    expect(item!.preview.startsWith("Heading word")).toBe(true);
    expect(item!.preview.length).toBeLessThanOrEqual(151);
    expect(item!.tags).toEqual(["llm", "review"]);
    expect(item!.collections).toEqual([{ id: "col_1", name: "AI" }]);
  });

  it("returns when each item was last used, for the palette's Recently used group", async () => {
    const lastUsedAt = new Date("2026-11-27T09:00:00.000Z");
    findMany.mockResolvedValue([
      { id: "a", content: "x", language: null, lastUsedAt, type: { slug: "note", name: "Note", icon: null, color: "slate", isSystem: true }, collections: [], tags: [] },
    ]);

    const [item] = await getSearchItems(USER);

    expect(findMany.mock.calls[0]![0].select).toMatchObject({ lastUsedAt: true });
    expect(item!.lastUsedAt).toEqual(lastUsedAt);
  });

  it("previews a custom type's item as Markdown, like a note", async () => {
    findMany.mockResolvedValue([
      {
        id: "c",
        content: "## Symptoms\n\n- build fails",
        language: null,
        type: { slug: "problem", name: "Problem", icon: "bug", color: "rose", isSystem: false },
        collections: [],
        tags: [],
      },
    ]);

    const [item] = await getSearchItems(USER);

    expect(item!.preview).toBe("Symptoms build fails");
  });

  it("gives an empty preview to an item without content", async () => {
    findMany.mockResolvedValue([
      { id: "b", content: null, language: null, type: { slug: "link", name: "Link", color: "lime" }, collections: [], tags: [] },
    ]);

    const [item] = await getSearchItems(USER);

    expect(item!.preview).toBe("");
    expect(item!.tags).toEqual([]);
  });
});

describe("getItemsByCollection", () => {
  it("reads the first page, pinned then favorites then newest, and reports the full total", async () => {
    count.mockResolvedValue(250);

    const { totalCount } = await getItemsByCollection(USER, "col_1");

    expect(totalCount).toBe(250);
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: [{ isPinned: "desc" }, { isFavorite: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: ITEMS_PER_PAGE,
    });
  });

  it("reads only the rows of the page asked for", async () => {
    await getItemsByCollection(USER, "col_1", 3);

    expect(findMany.mock.calls[0]![0]).toMatchObject({ skip: 2 * ITEMS_PER_PAGE, take: ITEMS_PER_PAGE });
  });

  it("rejects page 0 before querying", async () => {
    await expect(getItemsByCollection(USER, "col_1", 0)).rejects.toThrow(RangeError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("flattens the collections of each item", async () => {
    findMany.mockResolvedValue([{ id: "a", collections: [{ collection: { id: "col_1", name: "DevOps" } }] }]);

    const { items } = await getItemsByCollection(USER, "col_1");

    expect(items[0]!.collections).toEqual([{ id: "col_1", name: "DevOps" }]);
  });
});

describe("getItemsByType", () => {
  it("reads the first page, pinned then favorites then newest, and reports the full total", async () => {
    count.mockResolvedValue(250);

    const { totalCount } = await getItemsByType(USER, { slug: "link" });

    expect(totalCount).toBe(250);
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: [{ isPinned: "desc" }, { isFavorite: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: ITEMS_PER_PAGE,
    });
  });

  it("reads only the rows of the page asked for", async () => {
    await getItemsByType(USER, { slug: "link" }, 3);

    expect(findMany.mock.calls[0]![0]).toMatchObject({ skip: 2 * ITEMS_PER_PAGE, take: ITEMS_PER_PAGE });
  });

  it("rejects page 0 before querying", async () => {
    await expect(getItemsByType(USER, { slug: "link" }, 0)).rejects.toThrow(RangeError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("flattens the collections, and is empty for an item in none", async () => {
    findMany.mockResolvedValue([
      { id: "a", collections: [{ collection: { id: "c1", name: "DevOps" } }, { collection: { id: "c2", name: "Infra" } }] },
      { id: "b", collections: [] },
    ]);

    const { items } = await getItemsByType(USER, { slug: "link" });

    expect(items.map(({ collections }) => collections)).toEqual([
      [
        { id: "c1", name: "DevOps" },
        { id: "c2", name: "Infra" },
      ],
      [],
    ]);
  });

  it("reads the collections by name", async () => {
    findMany.mockResolvedValue([]);

    await getItemsByType(USER, { slug: "link" });

    expect(findMany.mock.calls[0]![0].select.collections).toMatchObject({ orderBy: { collection: { name: "asc" } } });
  });
});

describe("getFavoriteItems", () => {
  it("reads newest first with a stable tie-break, up to the ceiling", async () => {
    await getFavoriteItems(USER);

    expect(findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: MAX_ITEM_LIMIT,
    });
  });
});

describe("getRecentItems", () => {
  it("reads the dashboard's count by default", async () => {
    await getRecentItems(USER);

    expect(findMany.mock.calls[0]![0].take).toBe(DASHBOARD_RECENT_ITEMS_LIMIT);
  });

  it("breaks ties on the date by id, so items saved together keep one order", async () => {
    await getRecentItems(USER);

    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
  });

  it("clamps a limit above the ceiling", async () => {
    await getRecentItems(USER, MAX_ITEM_LIMIT + 1);

    expect(findMany.mock.calls[0]![0].take).toBe(MAX_ITEM_LIMIT);
  });

  it("rejects a negative limit, which Prisma would read backwards", async () => {
    await expect(getRecentItems(USER, -5)).rejects.toThrow(RangeError);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getPinnedItems", () => {
  it("reads at most the dashboard's 5 pinned items, newest first", async () => {
    await getPinnedItems(USER);

    expect(DASHBOARD_PINNED_ITEMS_LIMIT).toBe(5);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: DASHBOARD_PINNED_ITEMS_LIMIT });
  });
});

describe("getRecentlyUsedItems", () => {
  it("reads only the user's used items, latest use first, up to the dashboard's count", async () => {
    findMany.mockResolvedValue([
      { id: "a", type: { slug: "note", name: "Note", icon: null, color: "slate", isSystem: true }, collections: [{ collection: { id: "c", name: "C" } }] },
    ]);

    const items = await getRecentlyUsedItems(USER);

    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER, lastUsedAt: { not: null } },
      orderBy: [{ lastUsedAt: "desc" }, { id: "asc" }],
      take: DASHBOARD_RECENTLY_USED_LIMIT,
    });
    expect(items[0]!.collections).toEqual([{ id: "c", name: "C" }]);
  });

  it("clamps a limit above the ceiling", async () => {
    await getRecentlyUsedItems(USER, MAX_ITEM_LIMIT + 1);
    expect(findMany.mock.calls[0]![0].take).toBe(MAX_ITEM_LIMIT);
  });
});

describe("getItemDetail", () => {
  it("reads the item and its tags only for that owner", async () => {
    await getItemDetail(USER, "item_1");

    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER });
    expect(findTags.mock.calls[0]![0].where).toEqual({ userId: USER, items: { some: { itemId: "item_1" } } });
  });

  it("is null when no item matches, which includes another user's item", async () => {
    findTags.mockResolvedValue([{ name: "bash" }]);

    await expect(getItemDetail(USER, "someone_elses")).resolves.toBeNull();
  });

  it("returns the detail with the tag names, asking for them sorted", async () => {
    const row = { content: "body", url: null, fileName: null, language: "bash", createdAt: new Date(0) };
    findFirst.mockResolvedValue(row);
    findTags.mockResolvedValue([{ name: "bash" }, { name: "ci" }]);

    await expect(getItemDetail(USER, "item_1")).resolves.toEqual({ ...row, tags: ["bash", "ci"] });
    expect(findTags.mock.calls[0]![0].orderBy).toEqual({ name: "asc" });
  });

  it("has an empty tag list for an untagged item", async () => {
    findFirst.mockResolvedValue({ content: "body" });

    await expect(getItemDetail(USER, "item_1")).resolves.toMatchObject({ tags: [] });
  });

  it("selects only flat fields, since each relation costs another round trip", async () => {
    await getItemDetail(USER, "item_1");

    expect(findFirst.mock.calls[0]![0].select).toEqual({
      content: true,
      url: true,
      fileName: true,
      language: true,
      createdAt: true,
    });
  });
});

describe("getItemForExplain", () => {
  it("reads the item only for that owner, with its type's slug", async () => {
    await getItemForExplain(USER, "item_1");

    expect(findFirst.mock.calls[0]![0]).toEqual({
      where: { id: "item_1", userId: USER },
      select: { content: true, language: true, type: { select: { slug: true } } },
    });
  });

  it("is null when no item matches, which includes another user's item", async () => {
    await expect(getItemForExplain(USER, "someone_elses")).resolves.toBeNull();
  });

  it("flattens the type to its slug", async () => {
    findFirst.mockResolvedValue({ content: "ls -la", language: "bash", type: { slug: "command" } });

    await expect(getItemForExplain(USER, "item_1")).resolves.toEqual({
      content: "ls -la",
      language: "bash",
      slug: "command",
    });
  });
});

describe("updateItem", () => {
  const row = {
    id: "item_1",
    title: "New title",
    description: null,
    fileSize: null,
    isPinned: false,
    isFavorite: true,
    updatedAt: new Date(1),
    type: { slug: "snippet", name: "Snippet", color: "blue" },
    collections: [{ collection: { id: "col_1", name: "DevOps" } }],
    content: "body",
    url: null,
    fileName: null,
    language: "bash",
    createdAt: new Date(0),
    tags: [{ tag: { name: "ci" } }, { tag: { name: "bash" } }],
  };

  beforeEach(() => {
    update.mockResolvedValue(row);
  });

  it("keeps the file name in the card as well as the detail", async () => {
    update.mockResolvedValue({ ...row, fileName: "spec.pdf", fileSize: 2048 });

    const { card, detail } = await updateItem(USER, "item_1", { title: "t", tags: [], collectionIds: [] });

    expect(card).toMatchObject({ fileName: "spec.pdf", fileSize: 2048 });
    expect(detail.fileName).toBe("spec.pdf");
  });

  it("keeps the URL in the card as well as the detail", async () => {
    update.mockResolvedValue({ ...row, url: "https://lucide.dev" });

    const { card, detail } = await updateItem(USER, "item_1", { title: "t", tags: [], collectionIds: [] });

    expect(card.url).toBe("https://lucide.dev");
    expect(detail.url).toBe("https://lucide.dev");
  });

  it("updates only that owner's item", async () => {
    await updateItem(USER, "item_1", { title: "New title", tags: [], collectionIds: [] });

    expect(update.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER });
  });

  it("replaces the tags, linking each name to that user's tag", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: ["bash"], collectionIds: [] });

    expect(update.mock.calls[0]![0].data.tags).toEqual({
      deleteMany: {},
      create: [
        {
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId: USER, name: "bash" } },
              create: { name: "bash", userId: USER },
            },
          },
        },
      ],
    });
  });

  it("replaces the collections with the chosen ones", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: [], collectionIds: ["c1"] });

    expect(update.mock.calls[0]![0].data.collections).toEqual({
      deleteMany: {},
      create: [{ collection: { connect: { id: "c1" } } }],
    });
  });

  it("takes the item out of every collection when none is chosen", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: [], collectionIds: [] });

    expect(update.mock.calls[0]![0].data.collections).toEqual({ deleteMany: {}, create: [] });
  });

  it("links a repeated tag name once", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: ["bash", "ci", "bash"], collectionIds: [] });

    const created = update.mock.calls[0]![0].data.tags.create;
    expect(created.map((link: { tag: { connectOrCreate: { create: { name: string } } } }) =>
      link.tag.connectOrCreate.create.name)).toEqual(["bash", "ci"]);
  });

  it("leaves fields that were not sent out of the write, and writes null to clear one", async () => {
    await updateItem(USER, "item_1", { title: "t", description: null, tags: [], collectionIds: [] });

    const { data } = update.mock.calls[0]![0];
    expect(data).toMatchObject({ title: "t", description: null });
    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("url");
    expect(data).not.toHaveProperty("language");
  });

  it("returns the card and the detail, with the tags sorted", async () => {
    const result = await updateItem(USER, "item_1", { title: "New title", tags: ["ci", "bash"], collectionIds: [] });

    expect(result.card).toEqual({
      id: "item_1",
      title: "New title",
      description: null,
      fileName: null,
      fileSize: null,
      url: null,
      isPinned: false,
      isFavorite: true,
      updatedAt: new Date(1),
      type: { slug: "snippet", name: "Snippet", color: "blue" },
      collections: [{ id: "col_1", name: "DevOps" }],
    });
    expect(result.detail).toEqual({
      content: "body",
      url: null,
      fileName: null,
      language: "bash",
      createdAt: new Date(0),
      tags: ["bash", "ci"],
    });
  });

  it("passes Prisma's error through when no item of that owner matches", async () => {
    update.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    await expect(updateItem(USER, "someone_elses", { title: "t", tags: [], collectionIds: [] })).rejects.toMatchObject({ code: "P2025" });
  });
});

describe("updatePromptContent", () => {
  const row = {
    id: "item_1",
    title: "Reviewer",
    description: null,
    fileSize: null,
    isPinned: false,
    isFavorite: false,
    updatedAt: new Date(1),
    type: { slug: "prompt", name: "Prompt", color: "purple" },
    collections: [],
    content: "The optimized prompt",
    url: null,
    fileName: null,
    language: null,
    createdAt: new Date(0),
    tags: [{ tag: { name: "review" } }, { tag: { name: "ai" } }],
  };

  beforeEach(() => {
    update.mockResolvedValue(row);
  });

  it("writes only the content, on the user's own prompt", async () => {
    await updatePromptContent(USER, "item_1", "The optimized prompt");

    const [args] = update.mock.calls[0]!;
    expect(args.where).toEqual({ id: "item_1", userId: USER, type: { slug: "prompt" } });
    expect(args.data).toEqual({ content: "The optimized prompt" });
  });

  it("returns the card and the detail, tags sorted", async () => {
    const { card, detail } = await updatePromptContent(USER, "item_1", "The optimized prompt");

    expect(card).toMatchObject({ id: "item_1", title: "Reviewer" });
    expect(detail).toMatchObject({ content: "The optimized prompt", tags: ["ai", "review"], createdAt: new Date(0) });
  });
});

describe("deleteItem", () => {
  beforeEach(() => {
    remove.mockResolvedValue({ fileUrl: null });
  });

  it("deletes only that owner's item", async () => {
    await deleteItem(USER, "item_1");

    expect(remove.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER });
  });

  it("returns the deleted item's file key, so its R2 object can go too", async () => {
    remove.mockResolvedValue({ fileUrl: "user_a/key/a.pdf" });

    await expect(deleteItem(USER, "item_1")).resolves.toEqual({ fileUrl: "user_a/key/a.pdf" });
    expect(remove.mock.calls[0]![0].select).toEqual({ fileUrl: true });
  });

  it("passes Prisma's error through when no item of that owner matches", async () => {
    remove.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    await expect(deleteItem(USER, "someone_elses")).rejects.toMatchObject({ code: "P2025" });
  });
});

describe("isFileKeyInUse", () => {
  it("looks for the key among that owner's items", async () => {
    findFirst.mockResolvedValue({ id: "item_1" });

    await expect(isFileKeyInUse(USER, "user_a/key/a.pdf")).resolves.toBe(true);
    expect(findFirst.mock.calls[0]![0].where).toEqual({ userId: USER, fileUrl: "user_a/key/a.pdf" });
  });

  it("is false when no item stores it", async () => {
    findFirst.mockResolvedValue(null);

    await expect(isFileKeyInUse(USER, "user_a/key/a.pdf")).resolves.toBe(false);
  });
});

describe("getItemFile", () => {
  it("looks only among that owner's items that have a file", async () => {
    findFirst.mockResolvedValue({ fileUrl: "user_a/key/a.pdf", fileName: "a.pdf" });

    await expect(getItemFile(USER, "item_1")).resolves.toEqual({ fileUrl: "user_a/key/a.pdf", fileName: "a.pdf" });
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER, fileUrl: { not: null } });
  });

  it("is null when nothing matches", async () => {
    findFirst.mockResolvedValue(null);

    await expect(getItemFile(USER, "item_1")).resolves.toBeNull();
  });

  it("falls back to a generic name when none was stored", async () => {
    findFirst.mockResolvedValue({ fileUrl: "user_a/key/a.pdf", fileName: null });

    await expect(getItemFile(USER, "item_1")).resolves.toEqual({ fileUrl: "user_a/key/a.pdf", fileName: "file" });
  });
});

describe("getItemFileKeys", () => {
  it("lists the keys of that owner's items that have a file", async () => {
    findMany.mockResolvedValue([{ fileUrl: "user_a/1/a.pdf" }, { fileUrl: "user_a/2/b.png" }]);

    await expect(getItemFileKeys(USER)).resolves.toEqual(["user_a/1/a.pdf", "user_a/2/b.png"]);
    expect(findMany.mock.calls[0]![0].where).toEqual({ userId: USER, fileUrl: { not: null } });
  });
});

describe("createItem", () => {
  const row = {
    id: "item_new",
    title: "Title",
    description: null,
    fileSize: null,
    isPinned: false,
    isFavorite: false,
    updatedAt: new Date(1),
    type: { slug: "note", name: "Note", color: "amber" },
    collections: [],
  };

  beforeEach(() => {
    findType.mockResolvedValue({ id: "type_note" });
    create.mockResolvedValue(row);
  });

  it("creates without a transaction when there is no limit (Pro)", async () => {
    await createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(assertBelowLimit).not.toHaveBeenCalled();
  });

  it("re-checks the Free limit inside the transaction, before creating", async () => {
    asMock(prisma.$transaction).mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));

    await createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] }, { maxItems: 50 });

    expect(assertBelowLimit).toHaveBeenCalledWith(prisma, USER, "items", 50);
    expect(asMock(assertBelowLimit).mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]!);
  });

  it("creates nothing when the locked re-count refuses", async () => {
    asMock(prisma.$transaction).mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
    asMock(assertBelowLimit).mockRejectedValue(new Error("limit"));

    await expect(
      createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] }, { maxItems: 50 }),
    ).rejects.toThrow("limit");
    expect(create).not.toHaveBeenCalled();
  });

  it("looks up the system type of that slug, never a user's own", async () => {
    await createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(findType.mock.calls[0]![0].where).toEqual({ slug: "note", userId: null, isSystem: true });
  });

  it("throws, creating nothing, when there is no such system type", async () => {
    findType.mockResolvedValue(null);

    await expect(createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the item for that owner, under that type, with its fields", async () => {
    await createItem(USER, { type: "note", title: "Title", content: "body", tags: [], collectionIds: [] });

    const { data } = create.mock.calls[0]![0];
    expect(data).toMatchObject({
      title: "Title",
      content: "body",
      user: { connect: { id: USER } },
      type: { connect: { id: "type_note" } },
    });
    expect(data).not.toHaveProperty("userId");
  });

  it("stores a file item's key, name, size and content type", async () => {
    await createItem(USER, {
      type: "file",
      title: "Report",
      contentType: "file",
      fileUrl: "user_a/key/report.pdf",
      fileName: "Report.pdf",
      fileSize: 2048,
      tags: [],
      collectionIds: [],
    });

    expect(findType.mock.calls[0]![0].where).toMatchObject({ slug: "file" });
    expect(create.mock.calls[0]![0].data).toMatchObject({
      contentType: "file",
      fileUrl: "user_a/key/report.pdf",
      fileName: "Report.pdf",
      fileSize: 2048,
    });
  });

  it("links each tag once, to that user's tag of that name", async () => {
    await createItem(USER, { type: "note", title: "Title", tags: ["bash", "bash"], collectionIds: [] });

    expect(create.mock.calls[0]![0].data.tags).toEqual({
      create: [
        {
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId: USER, name: "bash" } },
              create: { name: "bash", userId: USER },
            },
          },
        },
      ],
    });
  });

  it("returns the card with the collections flattened", async () => {
    const card = await createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(card).toMatchObject({ id: "item_new", collections: [] });
  });

  it("links the item to each chosen collection once", async () => {
    await createItem(USER, { type: "note", title: "Title", tags: [], collectionIds: ["c1", "c2", "c1"] });

    expect(create.mock.calls[0]![0].data.collections).toEqual({
      create: [{ collection: { connect: { id: "c1" } } }, { collection: { connect: { id: "c2" } } }],
    });
  });
});

describe("getCommandTexts", () => {
  it("reads only that user's items, among the ids given", async () => {
    await getCommandTexts(USER, ["a", "b"]);

    expect(findMany.mock.calls[0]![0].where).toEqual({ userId: USER, id: { in: ["a", "b"] } });
  });

  it("does not query when there are no ids", async () => {
    expect(await getCommandTexts(USER, [])).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });

  it("maps each id to its command, empty when the item has no content", async () => {
    findMany.mockResolvedValue([
      { id: "a", content: "ls -la" },
      { id: "b", content: null },
    ]);

    expect(await getCommandTexts(USER, ["a", "b"])).toEqual({
      a: { text: "ls -la", isCut: false },
      b: { text: "", isCut: false },
    });
  });

  it("cuts a command over the cap", async () => {
    findMany.mockResolvedValue([{ id: "a", content: "x".repeat(MAX_COMMAND_CHARS + 10) }]);

    const { a } = await getCommandTexts(USER, ["a"]);

    expect(a!.isCut).toBe(true);
    expect(a!.text).toHaveLength(MAX_COMMAND_CHARS);
  });
});

describe("getPromptPreviews", () => {
  it("reads only that user's items and tags, among the ids given", async () => {
    await getPromptPreviews(USER, ["a", "b"]);

    expect(findMany.mock.calls[0]![0].where).toEqual({ userId: USER, id: { in: ["a", "b"] } });
    expect(findItemTags.mock.calls[0]![0].where).toEqual({ itemId: { in: ["a", "b"] }, item: { userId: USER } });
  });

  it("loads the tags of the whole list in one query", async () => {
    await getPromptPreviews(USER, ["a", "b", "c"]);

    expect(findItemTags).toHaveBeenCalledOnce();
  });

  it("does not query when there are no ids", async () => {
    expect(await getPromptPreviews(USER, [])).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
    expect(findItemTags).not.toHaveBeenCalled();
  });

  it("maps each id to its excerpt, counts and sorted tags", async () => {
    findMany.mockResolvedValue([
      { id: "a", content: "# Review\n\nRank **every** finding." },
      { id: "b", content: null },
    ]);
    findItemTags.mockResolvedValue([
      { itemId: "a", tag: { name: "review" } },
      { itemId: "a", tag: { name: "ai" } },
    ]);

    expect(await getPromptPreviews(USER, ["a", "b"])).toEqual({
      a: { excerpt: "Review Rank every finding.", words: 4, tokens: 9, tags: ["ai", "review"] },
      b: { excerpt: "", words: 0, tokens: 0, tags: [] },
    });
  });
});

describe("getSnippetPreviews", () => {
  it("reads only that user's items and tags, among the ids given", async () => {
    await getSnippetPreviews(USER, ["a", "b"]);

    expect(findMany.mock.calls[0]![0].where).toEqual({ userId: USER, id: { in: ["a", "b"] } });
    expect(findItemTags.mock.calls[0]![0].where).toEqual({ itemId: { in: ["a", "b"] }, item: { userId: USER } });
  });

  it("loads the tags of the whole list in one query", async () => {
    await getSnippetPreviews(USER, ["a", "b", "c"]);

    expect(findItemTags).toHaveBeenCalledOnce();
  });

  it("does not query when there are no ids", async () => {
    expect(await getSnippetPreviews(USER, [])).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
    expect(findItemTags).not.toHaveBeenCalled();
  });

  it("maps each id to its first lines, line count, language and sorted tags", async () => {
    findMany.mockResolvedValue([
      { id: "a", content: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight", language: "ts" },
      { id: "b", content: null, language: null },
    ]);
    findItemTags.mockResolvedValue([
      { itemId: "a", tag: { name: "react" } },
      { itemId: "a", tag: { name: "hooks" } },
    ]);

    expect(await getSnippetPreviews(USER, ["a", "b"])).toEqual({
      a: { code: "one\ntwo\nthree\nfour\nfive\nsix\nseven", lineCount: 8, language: "ts", tags: ["hooks", "react"] },
      b: { code: "", lineCount: 0, language: null, tags: [] },
    });
  });
});

describe("setItemFavorite", () => {
  const executeRaw = prisma.$executeRaw as unknown as Mock;

  it("sets the flag on the user's own item only, leaving updatedAt alone", async () => {
    executeRaw.mockResolvedValue(1);

    await expect(setItemFavorite(USER, "item_1", true)).resolves.toBe(true);

    const [strings, ...values] = executeRaw.mock.calls[0];
    const sql = (strings as TemplateStringsArray).join("?");
    expect(sql).toMatch(/UPDATE "Item" SET "isFavorite" = \?/);
    expect(sql).toMatch(/"userId" = \?/);
    expect(sql).not.toMatch(/updatedAt/);
    expect(values).toEqual([true, "item_1", USER]);
  });

  it("is false when no row matched", async () => {
    executeRaw.mockResolvedValue(0);

    await expect(setItemFavorite(USER, "item_1", false)).resolves.toBe(false);
  });
});

describe("setItemPinned", () => {
  const executeRaw = prisma.$executeRaw as unknown as Mock;

  it("sets the flag on the user's own item only, leaving updatedAt alone", async () => {
    executeRaw.mockResolvedValue(1);

    await expect(setItemPinned(USER, "item_1", true)).resolves.toBe(true);

    const [strings, ...values] = executeRaw.mock.calls[0];
    const sql = (strings as TemplateStringsArray).join("?");
    expect(sql).toMatch(/UPDATE "Item" SET "isPinned" = \?/);
    expect(sql).toMatch(/"userId" = \?/);
    expect(sql).not.toMatch(/updatedAt/);
    expect(values).toEqual([true, "item_1", USER]);
  });

  it("is false when no row matched", async () => {
    executeRaw.mockResolvedValue(0);

    await expect(setItemPinned(USER, "item_1", false)).resolves.toBe(false);
  });
});

describe("markItemUsed", () => {
  const executeRaw = prisma.$executeRaw as unknown as Mock;

  it("stamps the user's own item, throttled in the query, leaving updatedAt alone", async () => {
    executeRaw.mockResolvedValue(1);

    await expect(markItemUsed(USER, "item_1")).resolves.toBe(true);

    const [strings, ...values] = executeRaw.mock.calls[0];
    const sql = (strings as TemplateStringsArray).join("?").replace(/\s+/g, " ");
    expect(sql).toMatch(/UPDATE "Item" SET "lastUsedAt" = now\(\)/);
    expect(sql).toMatch(/"id" = \? AND "userId" = \?/);
    expect(sql).toMatch(/\("lastUsedAt" IS NULL OR "lastUsedAt" < now\(\) - interval '5 minutes'\)/);
    expect(sql).not.toMatch(/updatedAt/);
    // Values are bound, never concatenated into the SQL.
    expect(values).toEqual(["item_1", USER]);
  });

  it("is false when the throttle skipped the write, or the item is missing or not the user's", async () => {
    executeRaw.mockResolvedValue(0);

    await expect(markItemUsed(USER, "item_1")).resolves.toBe(false);
  });
});

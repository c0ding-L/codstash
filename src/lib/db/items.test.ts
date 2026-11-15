import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { MAX_COMMAND_CHARS } from "@/lib/command-text";
import {
  createItem,
  deleteItem,
  getCommandTexts,
  getItemDetail,
  getItemFile,
  getItemFileKeys,
  getItemsByType,
  getPinnedItems,
  getRecentItems,
  updateItem,
} from "@/lib/db/items";
import { MAX_ITEM_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
  },
}));

const findMany = prisma.item.findMany as unknown as Mock;
const findFirst = prisma.item.findFirst as unknown as Mock;
const count = prisma.item.count as unknown as Mock;
const findTags = prisma.tag.findMany as unknown as Mock;
const update = prisma.item.update as unknown as Mock;
const remove = prisma.item.delete as unknown as Mock;
const create = prisma.item.create as unknown as Mock;
const findType = prisma.itemType.findFirst as unknown as Mock;

const USER = "user_a";

beforeEach(() => {
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
  findFirst.mockResolvedValue(null);
  findTags.mockResolvedValue([]);
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
    collection: { name: "DevOps" },
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

    const { card, detail } = await updateItem(USER, "item_1", { title: "t", tags: [] });

    expect(card).toMatchObject({ fileName: "spec.pdf", fileSize: 2048 });
    expect(detail.fileName).toBe("spec.pdf");
  });

  it("updates only that owner's item", async () => {
    await updateItem(USER, "item_1", { title: "New title", tags: [] });

    expect(update.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER });
  });

  it("replaces the tags, linking each name to that user's tag", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: ["bash"] });

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

  it("links a repeated tag name once", async () => {
    await updateItem(USER, "item_1", { title: "t", tags: ["bash", "ci", "bash"] });

    const created = update.mock.calls[0]![0].data.tags.create;
    expect(created.map((link: { tag: { connectOrCreate: { create: { name: string } } } }) =>
      link.tag.connectOrCreate.create.name)).toEqual(["bash", "ci"]);
  });

  it("leaves fields that were not sent out of the write, and writes null to clear one", async () => {
    await updateItem(USER, "item_1", { title: "t", description: null, tags: [] });

    const { data } = update.mock.calls[0]![0];
    expect(data).toMatchObject({ title: "t", description: null });
    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("url");
    expect(data).not.toHaveProperty("language");
  });

  it("returns the card and the detail, with the tags sorted", async () => {
    const result = await updateItem(USER, "item_1", { title: "New title", tags: ["ci", "bash"] });

    expect(result.card).toEqual({
      id: "item_1",
      title: "New title",
      description: null,
      fileName: null,
      fileSize: null,
      isPinned: false,
      isFavorite: true,
      updatedAt: new Date(1),
      type: { slug: "snippet", name: "Snippet", color: "blue" },
      collectionName: "DevOps",
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

    await expect(updateItem(USER, "someone_elses", { title: "t", tags: [] })).rejects.toMatchObject({ code: "P2025" });
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
    collection: null,
  };

  beforeEach(() => {
    findType.mockResolvedValue({ id: "type_note" });
    create.mockResolvedValue(row);
  });

  it("looks up the system type of that slug, never a user's own", async () => {
    await createItem(USER, { type: "note", title: "Title", tags: [] });

    expect(findType.mock.calls[0]![0].where).toEqual({ slug: "note", userId: null, isSystem: true });
  });

  it("throws, creating nothing, when there is no such system type", async () => {
    findType.mockResolvedValue(null);

    await expect(createItem(USER, { type: "note", title: "Title", tags: [] })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the item for that owner, under that type, with its fields", async () => {
    await createItem(USER, { type: "note", title: "Title", content: "body", tags: [] });

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
    await createItem(USER, { type: "note", title: "Title", tags: ["bash", "bash"] });

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

  it("returns the card with the collection flattened", async () => {
    const card = await createItem(USER, { type: "note", title: "Title", tags: [] });

    expect(card).toMatchObject({ id: "item_new", collectionName: null });
    expect(card).not.toHaveProperty("collection");
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

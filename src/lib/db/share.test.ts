import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { countShares, getSharedCollection, getSharedItem, getShareTarget, saveShare } from "@/lib/db/share";
import { prisma } from "@/lib/prisma";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    collection: { findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    item: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const transaction = asMock(prisma.$transaction);
const lockUser = asMock(prisma.$queryRaw);
const execute = asMock(prisma.$executeRaw);
const findItem = asMock(prisma.item.findFirst);
const findItemByShare = asMock(prisma.item.findUnique);
const findItems = asMock(prisma.item.findMany);
const countItems = asMock(prisma.item.count);
const findCollection = asMock(prisma.collection.findFirst);
const findCollectionByShare = asMock(prisma.collection.findUnique);
const countCollections = asMock(prisma.collection.count);

const USER = "user_a";
const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

/** Made-up key with the right shape, built from pieces as in `secrets.test.ts`. */
const FAKE_TOKEN = "ghp_" + "q7Rk2Lm9Vt4Bn8Zc".repeat(3);

/** The values bound into the raw UPDATE, after the template strings. */
function boundValues(call = 0) {
  const [, ...values] = execute.mock.calls[call]! as [unknown, ...unknown[]];
  return values;
}

/** Every key a Prisma select asks for, nested ones included. */
function selectedKeys(select: Record<string, unknown>): string[] {
  return Object.entries(select).flatMap(([key, value]) =>
    value && typeof value === "object" && "select" in value
      ? [key, ...selectedKeys((value as { select: Record<string, unknown> }).select)]
      : [key],
  );
}

beforeEach(() => {
  transaction.mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma));
  lockUser.mockResolvedValue([]);
  execute.mockResolvedValue(1);
  countItems.mockResolvedValue(0);
  countCollections.mockResolvedValue(0);
  findItems.mockResolvedValue([]);
});

describe("getShareTarget", () => {
  it("reads only the owner's item, with what the action needs", async () => {
    findItem.mockResolvedValue({
      shareId: null,
      shareIndexable: true,
      shareShowOwner: false,
      contentType: "text",
      title: "Prompt",
      description: null,
      content: "Hi",
      url: null,
    });

    expect(await getShareTarget(USER, "item", "item_1")).toEqual({
      shareId: null,
      indexable: true,
      showOwner: false,
      contentType: "text",
      scanned: [{ title: "Prompt", description: null, content: "Hi", url: null }],
    });
    expect(findItem.mock.calls[0]![0].where).toEqual({ id: "item_1", userId: USER });
  });

  it("is null for another user's item or collection", async () => {
    findItem.mockResolvedValue(null);
    findCollection.mockResolvedValue(null);

    expect(await getShareTarget(USER, "item", "theirs")).toBeNull();
    expect(await getShareTarget(USER, "collection", "theirs")).toBeNull();
    expect(findCollection.mock.calls[0]![0].where).toEqual({ id: "theirs", userId: USER });
  });

  it("scans the collection's text items only, the owner's", async () => {
    findCollection.mockResolvedValue({ shareId: SHARE_ID, shareIndexable: false, shareShowOwner: true });
    findItems.mockResolvedValue([{ title: "A", description: null, content: "x", url: null }]);

    const target = await getShareTarget(USER, "collection", "col_1");

    expect(target).toMatchObject({ shareId: SHARE_ID, showOwner: true, contentType: "text" });
    expect(target!.scanned).toHaveLength(1);
    expect(findItems.mock.calls[0]![0].where).toEqual({
      userId: USER,
      contentType: "text",
      collections: { some: { collectionId: "col_1" } },
    });
  });
});

describe("countShares", () => {
  it("adds the shared collections and the shared items of the user", async () => {
    countCollections.mockResolvedValue(1);
    countItems.mockResolvedValue(2);

    expect(await countShares(USER)).toBe(3);
    expect(countCollections).toHaveBeenCalledWith({ where: { userId: USER, shareId: { not: null } } });
    expect(countItems).toHaveBeenCalledWith({ where: { userId: USER, shareId: { not: null } } });
  });
});

describe("saveShare", () => {
  const off = { shared: false, indexable: false, showOwner: false, newLink: false, currentShareId: SHARE_ID };

  it("turns sharing off with a null id, without a transaction", async () => {
    expect(await saveShare(USER, "item", "item_1", off, { maxShares: 3 })).toEqual({ found: true, shareId: null });
    expect(transaction).not.toHaveBeenCalled();
    // shareId, indexable, showOwner, then the CASE's two shareId bindings, then the id and the owner.
    expect(boundValues()).toEqual([null, false, false, null, null, "item_1", USER]);
  });

  it("makes a new id under the user lock when Free turns a link on", async () => {
    const saved = await saveShare(
      USER,
      "collection",
      "col_1",
      { shared: true, indexable: true, showOwner: false, newLink: false, currentShareId: null },
      { maxShares: 3 },
    );

    expect(saved.found).toBe(true);
    expect(saved.shareId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(transaction).toHaveBeenCalledOnce();
    expect(lockUser).toHaveBeenCalledOnce();
    expect(boundValues()[0]).toBe(saved.shareId);
  });

  it("throws LimitReachedError when the locked count is at the cap", async () => {
    countItems.mockResolvedValue(3);

    await expect(
      saveShare(USER, "item", "item_1", { ...off, shared: true, currentShareId: null }, { maxShares: 3 }),
    ).rejects.toBeInstanceOf(LimitReachedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps the current id for a toggle, and makes a new one for a reset", async () => {
    const toggled = await saveShare(USER, "item", "item_1", { ...off, shared: true, indexable: true }, { maxShares: 3 });
    expect(toggled.shareId).toBe(SHARE_ID);

    const reset = await saveShare(USER, "item", "item_1", { ...off, shared: true, newLink: true }, { maxShares: 3 });
    expect(reset.shareId).not.toBe(SHARE_ID);
    // Already shared: neither is counted against the cap.
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not lock for Pro", async () => {
    await saveShare(USER, "item", "item_1", { ...off, shared: true, currentShareId: null });
    expect(transaction).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("reports another user's row as not found", async () => {
    execute.mockResolvedValue(0);
    expect(await saveShare(USER, "item", "theirs", off)).toEqual({ found: false, shareId: null });
  });
});

describe("getSharedItem", () => {
  const row = {
    id: "item_1",
    title: "Prompt",
    description: "Reviews code",
    content: "Review {{file}}",
    url: null,
    language: null,
    updatedAt: new Date(1),
    type: { slug: "prompt", name: "Prompt", icon: null, color: null, isSystem: true },
    tags: [{ tag: { name: "review" } }, { tag: { name: "ai" } }],
    contentType: "text",
    shareIndexable: false,
    shareShowOwner: false,
    user: { name: "Ada" },
  };

  it("looks up by share id and selects no email, user id or collections", async () => {
    findItemByShare.mockResolvedValue(row);

    await getSharedItem(SHARE_ID);

    const args = findItemByShare.mock.calls[0]![0];
    expect(args.where).toEqual({ shareId: SHARE_ID });
    const keys = selectedKeys(args.select);
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("userId");
    expect(keys).not.toContain("collections");
    expect(keys).not.toContain("fileUrl");
    expect(args.select.user).toEqual({ select: { name: true } });
  });

  it("returns the item with sorted tags, and the owner's name only when opted in", async () => {
    findItemByShare.mockResolvedValue(row);
    const hidden = await getSharedItem(SHARE_ID);
    expect(hidden).toMatchObject({ title: "Prompt", tags: ["ai", "review"], indexable: false, ownerName: null });
    expect(hidden).not.toHaveProperty("user");

    findItemByShare.mockResolvedValue({ ...row, shareShowOwner: true, shareIndexable: true });
    expect(await getSharedItem("BbCdEfGhIjKlMnOpQrStUv")).toMatchObject({ ownerName: "Ada", indexable: true });
  });

  it("is null for an unknown id, a file item, or an item that now holds a secret", async () => {
    findItemByShare.mockResolvedValue(null);
    expect(await getSharedItem("CbCdEfGhIjKlMnOpQrStUv")).toBeNull();

    findItemByShare.mockResolvedValue({ ...row, contentType: "file" });
    expect(await getSharedItem("DbCdEfGhIjKlMnOpQrStUv")).toBeNull();

    findItemByShare.mockResolvedValue({ ...row, content: FAKE_TOKEN });
    expect(await getSharedItem("EbCdEfGhIjKlMnOpQrStUv")).toBeNull();
  });
});

describe("getSharedCollection", () => {
  it("is null for an unknown or revoked id", async () => {
    findCollectionByShare.mockResolvedValue(null);
    expect(await getSharedCollection(SHARE_ID)).toBeNull();
    expect(findCollectionByShare.mock.calls[0]![0].where).toEqual({ shareId: SHARE_ID });
    expect(findItems).not.toHaveBeenCalled();
  });

  it("reads the owner's text items of the collection, and no email", async () => {
    findCollectionByShare.mockResolvedValue({
      id: "col_1",
      userId: USER,
      name: "Prompts",
      description: null,
      shareIndexable: false,
      shareShowOwner: false,
      user: { name: "Ada" },
    });

    const collection = await getSharedCollection("FbCdEfGhIjKlMnOpQrStUv");

    expect(collection).toEqual({ name: "Prompts", description: null, indexable: false, ownerName: null, items: [] });
    expect(selectedKeys(findCollectionByShare.mock.calls[0]![0].select)).not.toContain("email");
    const items = findItems.mock.calls[0]![0];
    expect(items.where).toEqual({ userId: USER, contentType: "text", collections: { some: { collectionId: "col_1" } } });
    const keys = selectedKeys(items.select);
    expect(keys).not.toContain("userId");
    expect(keys).not.toContain("collections");
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { roomBelowLimit } from "@/lib/db/billing";
import { createCollection } from "@/lib/db/collections";
import { IMPORT_CHUNK_SIZE, getGithubAccessToken, importCandidates } from "@/lib/db/import";
import { createCustomType, isCustomTypeNameTaken } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/lib/db/billing", () => ({ roomBelowLimit: vi.fn(), assertBelowLimit: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ createCollection: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ createCustomType: vi.fn(), isCustomTypeNameTaken: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    item: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    itemType: { findMany: vi.fn(), findFirst: vi.fn() },
    collection: { findMany: vi.fn() },
    account: { findFirst: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const USER = "user_1";
const SYSTEM = { snippet: "t_snippet", note: "t_note", prompt: "t_prompt", command: "t_command", link: "t_link" };
const tx = {
  item: { createMany: vi.fn() },
  tag: { createMany: vi.fn(), findMany: vi.fn() },
  itemTag: { createMany: vi.fn() },
  itemCollection: { createMany: vi.fn() },
};

const note = (title: string, extra: Record<string, unknown> = {}) => ({ title, type: "note", content: "Body", tags: [], collectionNames: [], ...extra });
const pro = { conflict: "duplicate", customTypes: true } as const;
const free = { conflict: "duplicate", customTypes: false, maxItems: 50, maxCollections: 3 } as const;

type Row = { id: string; title: string; typeId: string; userId: string; [key: string]: unknown };

/** Every item row written, in order, across the chunks' bulk inserts. */
function createdData(): Row[] {
  return tx.item.createMany.mock.calls.flatMap(([args]) => args.data);
}

/** The tag names linked to an item, through the tag ids the mock gave out. */
function tagNamesOf(itemId: string): string[] {
  const links = tx.itemTag.createMany.mock.calls.flatMap(([args]) => args.data) as { itemId: string; tagId: string }[];
  return links.filter((link) => link.itemId === itemId).map((link) => link.tagId.replace(/^tag_/, ""));
}

function collectionsOf(itemId: string): string[] {
  const links = tx.itemCollection.createMany.mock.calls.flatMap(([args]) => args.data) as { itemId: string; collectionId: string }[];
  return links.filter((link) => link.itemId === itemId).map((link) => link.collectionId);
}

beforeEach(() => {
  asMock(prisma.$transaction).mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  asMock(prisma.itemType.findMany).mockImplementation(async ({ where }: { where: { isSystem: boolean; slug: { in: string[] } } }) =>
    where.isSystem ? where.slug.in.map((slug) => ({ id: SYSTEM[slug as keyof typeof SYSTEM], slug })) : [],
  );
  asMock(prisma.item.findMany).mockResolvedValue([]);
  asMock(prisma.item.count).mockResolvedValue(0);
  asMock(prisma.collection.findMany).mockResolvedValue([]);
  asMock(isCustomTypeNameTaken).mockResolvedValue(false);
  for (const fn of [tx.item.createMany, tx.tag.createMany, tx.itemTag.createMany, tx.itemCollection.createMany]) {
    fn.mockReset();
    fn.mockResolvedValue({ count: 0 });
  }
  tx.tag.findMany.mockReset();
  tx.tag.findMany.mockImplementation(async ({ where }: { where: { name: { in: string[] } } }) =>
    where.name.in.map((name) => ({ id: `tag_${name}`, name })),
  );
});

describe("importCandidates", () => {
  it("writes each candidate for the user under its system type, favorite and pin kept", async () => {
    const result = await importCandidates(
      USER,
      [
        { title: "Hook", type: "snippet", content: "x", language: "typescript", tags: ["react"], collectionNames: [], isPinned: true },
        { title: "Docs", type: "link", url: "https://nextjs.org", tags: [], collectionNames: [], isFavorite: true },
      ],
      pro,
    );

    expect(result.created).toBe(2);
    const [hook, docs] = createdData();
    expect(hook).toMatchObject({
      title: "Hook",
      content: "x",
      language: "typescript",
      isPinned: true,
      isFavorite: false,
      userId: USER,
      typeId: "t_snippet",
    });
    expect(hook!.id).toMatch(/^c[0-9a-z]{24}$/);
    expect(tx.tag.createMany).toHaveBeenCalledWith({ data: [{ name: "react", userId: USER }], skipDuplicates: true });
    expect(tx.tag.findMany.mock.calls[0]![0].where).toEqual({ userId: USER, name: { in: ["react"] } });
    expect(tagNamesOf(hook!.id)).toEqual(["react"]);
    expect(docs).toMatchObject({ url: "https://nextjs.org", isFavorite: true, isPinned: false, typeId: "t_link" });
    expect(asMock(prisma.itemType.findMany).mock.calls[0]![0].where).toMatchObject({ userId: null, isSystem: true });
  });

  it("checks every candidate again and counts what it refuses", async () => {
    const result = await importCandidates(
      USER,
      [
        { title: "Evil", type: "link", url: "javascript:alert(1)", tags: [], collectionNames: [] },
        note("Huge", { content: "x".repeat(100_001) }),
        { title: "File", type: "file", tags: [], collectionNames: [] },
        note("Fine"),
      ],
      pro,
    );

    expect(result).toMatchObject({ created: 1, invalidTitles: ["Evil", "File"] });
    expect(result.skipped).toMatchObject({ invalid: 2, tooLong: 1 });
    expect(createdData().map((data) => data.title)).toEqual(["Fine"]);
  });

  it("with skip, leaves out a title and type the user has, and a repeat within the batch", async () => {
    asMock(prisma.item.findMany).mockResolvedValue([{ title: "Taken", typeId: "t_note" }]);

    const result = await importCandidates(
      USER,
      [note("Taken"), { ...note("Taken"), type: "prompt" }, note("New"), note("New")],
      { ...pro, conflict: "skip" },
    );

    expect(asMock(prisma.item.findMany).mock.calls[0]![0].where).toEqual({ userId: USER, title: { in: ["Taken", "New"] } });
    expect(result.skipped.duplicate).toBe(2);
    expect(createdData().map((data) => [data.title, data.typeId])).toEqual([
      ["Taken", "t_prompt"],
      ["New", "t_note"],
    ]);
  });

  it("with duplicate, keeps everything without looking", async () => {
    const result = await importCandidates(USER, [note("A"), note("A")], pro);

    expect(result.created).toBe(2);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });

  it("writes in chunks, one transaction each, with a timeout", async () => {
    const candidates = Array.from({ length: IMPORT_CHUNK_SIZE * 2 + 20 }, (_, i) => note(`N${i}`));

    const result = await importCandidates(USER, candidates, pro);

    expect(result.created).toBe(120);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(tx.item.createMany.mock.calls.map(([args]) => args.data.length)).toEqual([50, 50, 20]);
    expect(new Set(createdData().map((row) => row.id)).size).toBe(120);
    expect(asMock(prisma.$transaction).mock.calls[0]![1]).toEqual({ timeout: 30_000 });
    expect(roomBelowLimit).not.toHaveBeenCalled();
  });

  it("stops at the Free limit, re-counted under the lock, and reports the rest", async () => {
    asMock(roomBelowLimit).mockResolvedValueOnce(30);
    const candidates = Array.from({ length: 120 }, (_, i) => note(`N${i}`));

    const result = await importCandidates(USER, candidates, free);

    expect(roomBelowLimit).toHaveBeenCalledWith(tx, USER, "items", 50);
    expect(result.created).toBe(30);
    expect(result.skipped.limit).toBe(90);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("creates no collection when a Free user is already at the item limit", async () => {
    asMock(prisma.item.count).mockResolvedValue(50);

    const result = await importCandidates(USER, [note("A", { collectionNames: ["Ops"] }), note("B")], free);

    expect(asMock(prisma.item.count).mock.calls[0]![0]).toEqual({ where: { userId: USER } });
    expect(result).toMatchObject({ created: 0, collectionsCreated: 0, skipped: { limit: 2 } });
    expect(createCollection).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("matches collections by name, creates the missing ones with their description, and drops links past the limit", async () => {
    asMock(prisma.collection.findMany).mockResolvedValue([{ id: "c_react", name: "React" }]);
    asMock(createCollection)
      .mockResolvedValueOnce({ id: "c_ops" })
      .mockRejectedValueOnce(new LimitReachedError("collections"));

    const result = await importCandidates(
      USER,
      [note("A", { collectionNames: ["react", "Ops"] }), note("B", { collectionNames: ["Extra", "Ops"] })],
      { ...free, collections: [{ name: "Ops", description: "Servers" }, { name: "Bad", description: 3 }] },
    );

    expect(asMock(prisma.collection.findMany).mock.calls[0]![0].where).toEqual({ userId: USER });
    expect(createCollection).toHaveBeenNthCalledWith(1, USER, { name: "Ops", description: "Servers" }, { maxCollections: 3 });
    expect(createCollection).toHaveBeenNthCalledWith(2, USER, { name: "Extra", description: null }, { maxCollections: 3 });
    expect(result).toMatchObject({ created: 2, collectionsCreated: 1, collectionLinksDropped: 1 });
    const [a, b] = createdData();
    expect(collectionsOf(a!.id)).toEqual(["c_react", "c_ops"]);
    expect(collectionsOf(b!.id)).toEqual(["c_ops"]);
  });

  describe("custom types", () => {
    const recipe = { title: "Pancakes", type: { customSlug: "recipe" }, content: "Eggs", language: "markdown", tags: ["food"], collectionNames: [] };
    const def = { slug: "recipe", name: "Recipe", icon: "book-open", color: "orange", template: null };

    it("become notes tagged type:<slug> for a Free user", async () => {
      await importCandidates(USER, [recipe], { ...free, types: [def] });

      const [data] = createdData();
      expect(data!.typeId).toBe("t_note");
      expect(tagNamesOf(data!.id)).toEqual(["food", "type:recipe"]);
      expect(data!.language).toBeNull();
      expect(createCustomType).not.toHaveBeenCalled();
    });

    it("use the Pro user's own type of that slug", async () => {
      asMock(prisma.itemType.findMany).mockImplementation(async ({ where }: { where: { isSystem: boolean; userId: string | null } }) =>
        where.isSystem ? [] : [{ id: "t_recipe", slug: "recipe" }],
      );

      await importCandidates(USER, [recipe], pro);

      expect(asMock(prisma.itemType.findMany).mock.calls[0]![0].where).toEqual({ userId: USER, isSystem: false, slug: { in: ["recipe"] } });
      expect(createdData()[0]).toMatchObject({ typeId: "t_recipe", language: "markdown" });
    });

    it("are recreated for Pro from a valid definition", async () => {
      asMock(createCustomType).mockResolvedValue({ id: "t_new", slug: "recipe" });

      await importCandidates(USER, [recipe], { ...pro, types: [def] });

      expect(createCustomType).toHaveBeenCalledWith(USER, { slug: "recipe", name: "Recipe", icon: "book-open", color: "orange", template: null });
      expect(createdData()[0]!.typeId).toBe("t_new");
    });

    it("fall back to a note when the definition is invalid, the name taken or the cap reached", async () => {
      await importCandidates(USER, [recipe], { ...pro, types: [{ ...def, icon: "not-an-icon" }] });
      await importCandidates(USER, [recipe], { ...pro, types: [{ ...def, slug: "other" }] });
      asMock(isCustomTypeNameTaken).mockResolvedValueOnce(true);
      await importCandidates(USER, [recipe], { ...pro, types: [def] });
      asMock(createCustomType).mockRejectedValueOnce(new LimitReachedError("customTypes"));
      await importCandidates(USER, [recipe], { ...pro, types: [def] });

      expect(createdData().map((data) => data.typeId)).toEqual(["t_note", "t_note", "t_note", "t_note"]);
    });

    it("use the type another batch created meanwhile", async () => {
      asMock(createCustomType).mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
      asMock(prisma.itemType.findFirst).mockResolvedValue({ id: "t_raced" });

      await importCandidates(USER, [recipe], { ...pro, types: [def] });

      expect(asMock(prisma.itemType.findFirst).mock.calls[0]![0].where).toEqual({ userId: USER, isSystem: false, slug: "recipe" });
      expect(createdData()[0]!.typeId).toBe("t_raced");
    });
  });
});

describe("getGithubAccessToken", () => {
  it("reads the user's own GitHub account token", async () => {
    asMock(prisma.account.findFirst).mockResolvedValue({ access_token: "gho_x" });

    expect(await getGithubAccessToken(USER)).toBe("gho_x");
    expect(asMock(prisma.account.findFirst).mock.calls[0]![0].where).toEqual({ userId: USER, provider: "github", access_token: { not: null } });
  });

  it("is null without a linked account", async () => {
    asMock(prisma.account.findFirst).mockResolvedValue(null);
    expect(await getGithubAccessToken(USER)).toBeNull();
  });
});

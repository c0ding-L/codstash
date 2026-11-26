import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  createCustomType,
  deleteCustomType,
  getCustomTypeBySlug,
  getCustomTypes,
  isCustomTypeNameTaken,
  ownsCustomType,
  resolveTypeSegment,
  updateCustomType,
} from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    itemType: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const findMany = asMock(prisma.itemType.findMany);
const findFirst = asMock(prisma.itemType.findFirst);
const update = asMock(prisma.itemType.update);
const remove = asMock(prisma.itemType.delete);
const transaction = asMock(prisma.$transaction);

const USER = "user_a";
const DATA = { name: "Problem", slug: "problem", icon: "bug", color: "rose", template: null };

/** A transaction client whose count and create can be set per test. */
const tx = { $queryRaw: vi.fn(), itemType: { count: vi.fn(), create: vi.fn() } };

beforeEach(() => {
  findMany.mockResolvedValue([]);
  findFirst.mockResolvedValue(null);
  update.mockResolvedValue({ id: "typ_1", slug: "problem" });
  remove.mockResolvedValue({});
  transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx));
  tx.$queryRaw.mockResolvedValue([]);
  tx.itemType.count.mockResolvedValue(0);
  tx.itemType.create.mockResolvedValue({ id: "typ_1", slug: "problem" });
});

describe("owner filters", () => {
  it("lists only the user's custom types, counting only their items", async () => {
    findMany.mockResolvedValue([
      { id: "typ_1", slug: "problem", name: "Problem", icon: "bug", color: "rose", template: null, _count: { items: 2 } },
    ]);

    const types = await getCustomTypes(USER);

    const args = findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: USER, isSystem: false });
    expect(args.select._count).toEqual({ select: { items: { where: { userId: USER } } } });
    expect(types).toEqual([
      { id: "typ_1", slug: "problem", name: "Problem", icon: "bug", color: "rose", template: null, isSystem: false, itemCount: 2 },
    ]);
  });

  it.each([
    ["getCustomTypeBySlug", () => getCustomTypeBySlug(USER, "problem"), { userId: USER, slug: "problem", isSystem: false }],
    ["ownsCustomType", () => ownsCustomType(USER, "typ_1"), { id: "typ_1", userId: USER, isSystem: false }],
    ["deleteCustomType", () => deleteCustomType(USER, "typ_1"), { id: "typ_1", userId: USER, isSystem: false }],
  ])("%s looks only among the user's custom types", async (_name, read, where) => {
    await read();

    expect(findFirst.mock.calls[0]![0].where).toEqual(where);
  });

  it("checks a name ignoring case, among the user's other custom types", async () => {
    await isCustomTypeNameTaken(USER, "problem", "typ_1");

    expect(findFirst.mock.calls[0]![0].where).toEqual({
      userId: USER,
      isSystem: false,
      name: { equals: "problem", mode: "insensitive" },
      id: { not: "typ_1" },
    });
  });

  it("updates only the user's own custom type", async () => {
    await updateCustomType(USER, "typ_1", DATA);

    expect(update.mock.calls[0]![0].where).toEqual({ id: "typ_1", userId: USER, isSystem: false });
  });

  it("creates the type for the user, never as a system type", async () => {
    await createCustomType(USER, DATA);

    expect(tx.itemType.count).toHaveBeenCalledWith({ where: { userId: USER, isSystem: false } });
    expect(tx.itemType.create.mock.calls[0]![0].data).toEqual({
      ...DATA,
      isSystem: false,
      user: { connect: { id: USER } },
    });
  });
});

describe("createCustomType", () => {
  it("throws LimitReachedError at 20 types, re-counted under the lock", async () => {
    tx.itemType.count.mockResolvedValue(20);

    await expect(createCustomType(USER, DATA)).rejects.toBeInstanceOf(LimitReachedError);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.itemType.create).not.toHaveBeenCalled();
  });
});

describe("deleteCustomType", () => {
  it("is null for a type that is not the user's", async () => {
    expect(await deleteCustomType(USER, "someone_elses")).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps a type that items still use, with their count", async () => {
    findFirst.mockResolvedValue({ _count: { items: 3 } });

    expect(await deleteCustomType(USER, "typ_1")).toEqual({ deleted: false, itemCount: 3 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes an empty one, filtered on the owner", async () => {
    findFirst.mockResolvedValue({ _count: { items: 0 } });

    expect(await deleteCustomType(USER, "typ_1")).toEqual({ deleted: true });
    expect(remove).toHaveBeenCalledWith({ where: { id: "typ_1", userId: USER, isSystem: false } });
  });
});

describe("resolveTypeSegment", () => {
  it("knows a system plural without the database", async () => {
    expect(await resolveTypeSegment(USER, "snippets")).toEqual({ kind: "system", slug: "snippet" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each([["new"], ["snippet"], ["Not A Slug"]])("is null for %j without the database", async (segment) => {
    expect(await resolveTypeSegment(USER, segment)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("looks the segment up as the user's custom slug", async () => {
    const type = { id: "typ_1", slug: "problem", name: "Problem", icon: "bug", color: "rose", template: null, isSystem: false };
    findFirst.mockResolvedValue(type);

    expect(await resolveTypeSegment(USER, "problem")).toEqual({ kind: "custom", type });
    expect(findFirst.mock.calls[0]![0].where).toEqual({ userId: USER, slug: "problem", isSystem: false });
  });

  it("is null when the user has no type of that slug", async () => {
    expect(await resolveTypeSegment(USER, "problem")).toBeNull();
  });
});

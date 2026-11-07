import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getProfile, getProfileStats } from "@/lib/db/profile";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    item: { count: vi.fn(), groupBy: vi.fn() },
    collection: { count: vi.fn() },
    itemType: { findMany: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const findUser = asMock(prisma.user.findUnique);
const countItems = asMock(prisma.item.count);
const groupItems = asMock(prisma.item.groupBy);
const countCollections = asMock(prisma.collection.count);
const findTypes = asMock(prisma.itemType.findMany);

const USER = "user_a";

describe("getProfile", () => {
  const row = { id: USER, name: "Ada", email: "ada@example.com", image: null, createdAt: new Date(0) };

  it("reads only that user", async () => {
    findUser.mockResolvedValue({ ...row, password: "stored-hash" });

    await getProfile(USER);

    expect(findUser.mock.calls[0]![0].where).toEqual({ id: USER });
  });

  // This object is passed to the page, so the hash must not travel with it.
  it("replaces the password hash with a flag", async () => {
    findUser.mockResolvedValue({ ...row, password: "stored-hash" });

    const profile = await getProfile(USER);

    expect(profile).toEqual({ ...row, hasPassword: true });
    expect(JSON.stringify(profile)).not.toContain("stored-hash");
  });

  it("flags a GitHub-only account", async () => {
    findUser.mockResolvedValue({ ...row, password: null });

    expect((await getProfile(USER))?.hasPassword).toBe(false);
  });

  it("returns null when the row is gone", async () => {
    findUser.mockResolvedValue(null);

    expect(await getProfile(USER)).toBeNull();
  });
});

describe("getProfileStats", () => {
  const SYSTEM = { userId: null };
  const types = [
    { id: "typ_snippet", slug: "snippet", name: "Snippet", color: "emerald", ...SYSTEM },
    { id: "typ_link", slug: "link", name: "Link", color: "lime", ...SYSTEM },
  ];

  beforeEach(() => {
    countItems.mockResolvedValue(0);
    countCollections.mockResolvedValue(0);
    groupItems.mockResolvedValue([]);
    findTypes.mockResolvedValue(types);
  });

  it("counts only that user's rows, and reads only system types and their own", async () => {
    await getProfileStats(USER);

    expect(countItems).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(countCollections).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(groupItems.mock.calls[0]![0].where).toEqual({ userId: USER });
    expect(findTypes.mock.calls[0]![0].where).toEqual({ OR: [{ userId: null }, { userId: USER }] });
  });

  it("lists all seven types in order, zeros included", async () => {
    groupItems.mockResolvedValue([{ typeId: "typ_link", _count: { _all: 6 } }]);

    const { byType } = await getProfileStats(USER);

    expect(byType.map(({ slug }) => slug)).toEqual(["snippet", "prompt", "note", "command", "link", "file", "image"]);
    expect(byType.find(({ slug }) => slug === "link")).toEqual({ slug: "link", color: "lime", count: 6 });
    expect(byType.find(({ slug }) => slug === "note")).toEqual({ slug: "note", color: null, count: 0 });
  });

  it("adds a custom type reusing a system slug to that row", async () => {
    findTypes.mockResolvedValue([...types, { id: "own_link", slug: "link", name: "My links", color: null }]);
    groupItems.mockResolvedValue([
      { typeId: "typ_link", _count: { _all: 6 } },
      { typeId: "own_link", _count: { _all: 2 } },
    ]);

    const { byType } = await getProfileStats(USER);

    expect(byType.find(({ slug }) => slug === "link")?.count).toBe(8);
  });

  it("counts other custom types in the total only", async () => {
    findTypes.mockResolvedValue([...types, { id: "own_podcast", slug: "podcast", name: "Podcast", color: null }]);
    groupItems.mockResolvedValue([{ typeId: "own_podcast", _count: { _all: 4 } }]);
    countItems.mockResolvedValue(4);

    const { totalItems, byType } = await getProfileStats(USER);

    expect(totalItems).toBe(4);
    expect(byType.every(({ count }) => count === 0)).toBe(true);
  });
});

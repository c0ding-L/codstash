import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { DEFAULT_EDITOR_PREFERENCES } from "@/lib/editor-preferences";
import { getEditorPreferences, getProfile, getProfileStats } from "@/lib/db/profile";
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
  const SYSTEM = { userId: null, icon: null, isSystem: true };
  const types = [
    { id: "typ_snippet", slug: "snippet", name: "Snippet", color: "emerald", ...SYSTEM },
    { id: "typ_link", slug: "link", name: "Link", color: "lime", ...SYSTEM },
  ];
  const OWN = { userId: USER, icon: "bug", isSystem: false };

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

  it("lists all seven system types in order, zeros included", async () => {
    groupItems.mockResolvedValue([{ typeId: "typ_link", _count: { _all: 6 } }]);

    const { byType } = await getProfileStats(USER);

    expect(byType.map(({ slug }) => slug)).toEqual(["snippet", "prompt", "note", "command", "link", "file", "image"]);
    expect(byType.find(({ slug }) => slug === "link")).toEqual({
      slug: "link",
      name: "Link",
      icon: null,
      color: "lime",
      isSystem: true,
      count: 6,
    });
    expect(byType.find(({ slug }) => slug === "note")).toMatchObject({ slug: "note", isSystem: true, count: 0 });
  });

  it("lists the user's custom types after the system ones, by name, with their counts", async () => {
    findTypes.mockResolvedValue([
      ...types,
      { id: "own_problem", slug: "problem", name: "Problem", color: "rose", ...OWN },
      { id: "own_bug", slug: "bug", name: "Bug", color: null, ...OWN },
    ]);
    groupItems.mockResolvedValue([{ typeId: "own_problem", _count: { _all: 4 } }]);
    countItems.mockResolvedValue(4);

    const { totalItems, byType } = await getProfileStats(USER);

    expect(totalItems).toBe(4);
    expect(byType.slice(7).map(({ slug, isSystem, count }) => ({ slug, isSystem, count }))).toEqual([
      { slug: "bug", isSystem: false, count: 0 },
      { slug: "problem", isSystem: false, count: 4 },
    ]);
    expect(byType.slice(0, 7).every(({ count }) => count === 0)).toBe(true);
  });
});

describe("getEditorPreferences", () => {
  it("reads only that user's preferences column", async () => {
    findUser.mockResolvedValue({ editorPreferences: null });

    await getEditorPreferences(USER);

    expect(findUser.mock.calls[0]![0]).toEqual({ where: { id: USER }, select: { editorPreferences: true } });
  });

  it("returns the defaults when nothing is saved or the row is gone", async () => {
    findUser.mockResolvedValueOnce({ editorPreferences: null }).mockResolvedValueOnce(null);

    expect(await getEditorPreferences(USER)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(await getEditorPreferences(USER)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it("merges what is saved over the defaults", async () => {
    findUser.mockResolvedValue({ editorPreferences: { fontSize: 16, theme: "github-dark" } });

    expect(await getEditorPreferences(USER)).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      fontSize: 16,
      theme: "github-dark",
    });
  });
});

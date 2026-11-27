import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET, PATCH } from "@/app/api/v1/items/[id]/route";
import { apiRequest, invalidToken, params, readCaller, readOnly, USER_ID, writeCaller } from "@/lib/__fixtures__/api-v1";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { authenticateApi } from "@/lib/api-auth";
import { getApiItem, getApiItemType, patchApiItem } from "@/lib/db/api-items";
import { ownsCollections } from "@/lib/db/collections";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  authenticateApi: vi.fn(),
}));
vi.mock("@/lib/db/api-items", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/api-items")>()),
  getApiItem: vi.fn(),
  getApiItemType: vi.fn(),
  patchApiItem: vi.fn(),
}));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const auth = asMock(authenticateApi);
const getItem = asMock(getApiItem);
const itemType = asMock(getApiItemType);
const patch = asMock(patchApiItem);

const ITEM = { id: "item_1", title: "Doc", file: { name: "a.pdf", size: 42 }, createdAt: new Date("2026-11-20T10:00:00.000Z") };

const getOne = (id = "item_1") => GET(apiRequest(`/items/${id}`), params(id));
const patchOne = (body: unknown, id = "item_1") => PATCH(apiRequest(`/items/${id}`, { method: "PATCH", body }), params(id));

beforeEach(() => {
  getItem.mockResolvedValue(ITEM);
  itemType.mockResolvedValue({ slug: "snippet", isSystem: true });
  patch.mockResolvedValue(ITEM);
  asMock(ownsCollections).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/v1/items/[id]", () => {
  beforeEach(() => auth.mockResolvedValue(readCaller));

  it("answers 401 without a valid token", async () => {
    auth.mockResolvedValue(invalidToken());
    expect((await getOne()).status).toBe(401);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("returns the caller's item with its file's name and size, and ISO dates", async () => {
    const response = await getOne();

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "read");
    expect(getItem).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(await response.json()).toEqual({ data: { ...ITEM, createdAt: "2026-11-20T10:00:00.000Z" } });
  });

  it("answers 404 for another user's item", async () => {
    getItem.mockResolvedValue(null);
    const response = await getOne("theirs");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Item not found." } });
  });
});

describe("PATCH /api/v1/items/[id]", () => {
  beforeEach(() => auth.mockResolvedValue(writeCaller));

  it("asks for the write scope, and passes on 403 for a read token", async () => {
    auth.mockResolvedValue(readOnly());
    const response = await patchOne({ title: "New" });

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "write");
    expect(response.status).toBe(403);
    expect(patch).not.toHaveBeenCalled();
  });

  it("updates only the fields sent", async () => {
    const response = await patchOne({ title: " New " });

    expect(response.status).toBe(200);
    expect(patch).toHaveBeenCalledWith(USER_ID, "item_1", { title: "New" });
  });

  it("clears a field sent as null or blank, and replaces tags and collections when sent", async () => {
    await patchOne({ description: "", language: null, tags: ["a"], collectionIds: ["c1", "c1"] });

    expect(patch).toHaveBeenCalledWith(USER_ID, "item_1", {
      description: null,
      language: null,
      tags: ["a"],
      collectionIds: ["c1"],
    });
    expect(ownsCollections).toHaveBeenCalledWith(USER_ID, ["c1"]);
  });

  it("answers 404 for another user's item", async () => {
    itemType.mockResolvedValue(null);
    const response = await patchOne({ title: "New" }, "theirs");

    expect(response.status).toBe(404);
    expect(patch).not.toHaveBeenCalled();
  });

  it("answers 404 when the item goes between the read and the update", async () => {
    patch.mockRejectedValue(Object.assign(new Error("gone"), { code: "P2025" }));
    expect((await patchOne({ title: "New" })).status).toBe(404);
  });

  it("answers 422 with English details, never a translation key", async () => {
    setTestLocale("fr");
    const response = await patchOne({ title: "", tags: Array.from({ length: 21 }, (_, i) => `t${i}`) });

    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).not.toContain("errors.");
    expect(JSON.parse(text).error.details).toEqual([
      { path: "title", message: "Title is required." },
      { path: "tags", message: "An item can have at most 20 tags." },
    ]);
  });

  it("refuses a field the item's type does not use", async () => {
    itemType.mockResolvedValue({ slug: "file", isSystem: true });
    const response = await patchOne({ content: "x", url: "https://example.com" });

    expect(response.status).toBe(422);
    expect((await response.json()).error.details.map((detail: { path: string }) => detail.path)).toEqual(["content", "url"]);
    expect(patch).not.toHaveBeenCalled();
  });

  it("refuses an empty patch, a collection the caller does not own and a body that is not JSON", async () => {
    expect((await patchOne({})).status).toBe(422);

    asMock(ownsCollections).mockResolvedValue(false);
    expect((await patchOne({ collectionIds: ["theirs"] })).status).toBe(422);

    expect((await patchOne("nope")).status).toBe(400);
    expect(patch).not.toHaveBeenCalled();
  });
});

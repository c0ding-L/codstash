import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET, POST } from "@/app/api/v1/items/route";
import {
  apiRequest,
  invalidToken,
  proRequired,
  readCaller,
  readOnly,
  USER_ID,
  writeCaller,
} from "@/lib/__fixtures__/api-v1";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { authenticateApi } from "@/lib/api-auth";
import { encodeCursor, findCustomTypeIdBySlug, getApiItem, listApiItems } from "@/lib/db/api-items";
import { ownsCollections } from "@/lib/db/collections";
import { ownsCustomType } from "@/lib/db/item-types";
import { createItem } from "@/lib/db/items";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  authenticateApi: vi.fn(),
}));
vi.mock("@/lib/db/api-items", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/api-items")>()),
  listApiItems: vi.fn(),
  getApiItem: vi.fn(),
  findCustomTypeIdBySlug: vi.fn(),
}));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ ownsCustomType: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ createItem: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const auth = asMock(authenticateApi);
const list = asMock(listApiItems);
const getItem = asMock(getApiItem);
const create = asMock(createItem);

const ITEM = { id: "item_1", title: "Sum", updatedAt: new Date("2026-11-20T10:00:00.000Z") };

const getItems = (query = "") => GET(apiRequest(`/items${query}`));
const postItem = (body: unknown) => POST(apiRequest("/items", { method: "POST", body }));

beforeEach(() => {
  list.mockResolvedValue({ items: [ITEM], nextCursor: null });
  getItem.mockResolvedValue(ITEM);
  create.mockResolvedValue({ id: "item_1" });
  asMock(ownsCollections).mockResolvedValue(true);
  asMock(ownsCustomType).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/v1/items", () => {
  beforeEach(() => auth.mockResolvedValue(readCaller));

  it("asks for the read scope and answers 401 without a valid token", async () => {
    auth.mockResolvedValue(invalidToken());
    const response = await getItems();

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "read");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "invalid_token", message: expect.any(String) } });
    expect(list).not.toHaveBeenCalled();
  });

  it("lists the caller's items with ISO dates and the next cursor", async () => {
    list.mockResolvedValue({ items: [ITEM], nextCursor: "abc" });
    const response = await getItems();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ ...ITEM, updatedAt: "2026-11-20T10:00:00.000Z" }],
      nextCursor: "abc",
    });
    expect(list).toHaveBeenCalledWith(USER_ID, { limit: 20, cursor: undefined });
  });

  it("passes the filters and a decoded cursor, and clamps the limit", async () => {
    const cursor = encodeCursor({ updatedAt: ITEM.updatedAt, id: "item_9" });
    await getItems(`?q=%20hook%20&type=snippet&tag=react&collection=c1&idSuffix=abcd1234&limit=500&cursor=${cursor}`);

    expect(list).toHaveBeenCalledWith(USER_ID, {
      q: "hook",
      type: "snippet",
      tag: "react",
      collection: "c1",
      idSuffix: "abcd1234",
      limit: 50,
      cursor: { updatedAt: ITEM.updatedAt, id: "item_9" },
    });
  });

  it.each([
    ["a limit below 1", "?limit=0", "limit"],
    ["a limit that is not a number", "?limit=ten", "limit"],
    ["a short idSuffix", "?idSuffix=abc", "idSuffix"],
    ["a cursor the API did not make", "?cursor=nonsense", "cursor"],
  ])("answers 422 for %s", async (_label, query, path) => {
    const response = await getItems(query);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.details).toEqual([{ path, message: expect.any(String) }]);
    expect(list).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/items", () => {
  beforeEach(() => auth.mockResolvedValue(writeCaller));

  it("asks for the write scope, and passes on 403 for a read token or a lapsed Pro", async () => {
    auth.mockResolvedValueOnce(readOnly());
    const response = await postItem({ type: "note", title: "x", tags: [], collectionIds: [] });
    expect(auth).toHaveBeenCalledWith(expect.any(Request), "write");
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("insufficient_scope");

    auth.mockResolvedValueOnce(proRequired());
    expect((await (await postItem({})).json()).error.code).toBe("pro_required");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a snippet and answers 201 with the full item", async () => {
    const response = await postItem({
      type: "snippet",
      title: "Sum",
      content: "a + b",
      language: "ts",
      url: "https://dropped.example",
      tags: ["math"],
      collectionIds: ["c1"],
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { ...ITEM, updatedAt: "2026-11-20T10:00:00.000Z" } });
    // A field the type does not use is stripped by the schema; no Free limit is passed.
    expect(create).toHaveBeenCalledWith(USER_ID, {
      type: "snippet",
      title: "Sum",
      content: "a + b",
      language: "ts",
      tags: ["math"],
      collectionIds: ["c1"],
    });
    expect(ownsCollections).toHaveBeenCalledWith(USER_ID, ["c1"]);
    expect(getItem).toHaveBeenCalledWith(USER_ID, "item_1");
  });

  it("answers 500, not 201 with null data, when the new item cannot be read back", async () => {
    getItem.mockResolvedValue(null);
    const response = await postItem({ type: "note", title: "x", tags: [], collectionIds: [] });

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });

  it.each(["file", "image"])("refuses a %s item with 422 unsupported_type", async (type) => {
    const response = await postItem({ type, title: "Doc", tags: [], collectionIds: [] });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("unsupported_type");
    expect(create).not.toHaveBeenCalled();
  });

  it("answers 422 with English details whatever the caller's language, never a translation key", async () => {
    setTestLocale("fr");
    const response = await postItem({ type: "link", title: "", url: "javascript:alert(1)", tags: [], collectionIds: [] });

    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).not.toContain("errors.");
    expect(text).not.toContain("items.");
    const { error } = JSON.parse(text);
    expect(error.code).toBe("invalid_request");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { path: "title", message: "Title is required." },
        { path: "url", message: "Enter a valid URL." },
      ]),
    );
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await postItem("{nope");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_json");
  });

  it("refuses a collection the caller does not own", async () => {
    asMock(ownsCollections).mockResolvedValue(false);
    const response = await postItem({ type: "note", title: "x", tags: [], collectionIds: ["theirs"] });

    expect(response.status).toBe(422);
    expect((await response.json()).error.details[0].path).toBe("collectionIds");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a custom-type item by its slug", async () => {
    asMock(findCustomTypeIdBySlug).mockResolvedValue("t9");
    const response = await postItem({ type: "recipes", title: "Bread", content: "flour", tags: [], collectionIds: [] });

    expect(response.status).toBe(201);
    expect(findCustomTypeIdBySlug).toHaveBeenCalledWith(USER_ID, "recipes");
    expect(create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ type: { customTypeId: "t9" }, title: "Bread", content: "flour" }),
    );
  });

  it("refuses an unknown type slug and another user's custom type id", async () => {
    asMock(findCustomTypeIdBySlug).mockResolvedValue(null);
    const unknown = await postItem({ type: "nope", title: "x", tags: [], collectionIds: [] });
    expect(unknown.status).toBe(422);
    expect((await unknown.json()).error.details[0].path).toBe("type");

    asMock(ownsCustomType).mockResolvedValue(false);
    const theirs = await postItem({ type: "custom", typeId: "t_other", title: "x", tags: [], collectionIds: [] });
    expect(theirs.status).toBe(422);
    expect((await theirs.json()).error.details[0].path).toBe("typeId");
    expect(create).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";

import { createItem, deleteItem, setItemFavorite, setItemPinned, updateItem } from "@/actions/items";
import { auth } from "@/auth";
import { ownsCollections } from "@/lib/db/collections";
import {
  createItem as createItemQuery,
  deleteItem as deleteItemQuery,
  isFileKeyInUse,
  setItemFavorite as setItemFavoriteQuery,
  setItemPinned as setItemPinnedQuery,
  updateItem as updateItemQuery,
} from "@/lib/db/items";
import { deleteObjectsQuietly, headObject } from "@/lib/r2";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  isFileKeyInUse: vi.fn(),
  setItemFavorite: vi.fn(),
  setItemPinned: vi.fn(),
}));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));
vi.mock("@/lib/r2", () => ({ headObject: vi.fn(), deleteObjectsQuietly: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = auth as unknown as Mock;
const query = updateItemQuery as unknown as Mock;
const deleteQuery = deleteItemQuery as unknown as Mock;
const createQuery = createItemQuery as unknown as Mock;
const head = headObject as unknown as Mock;
const deleteObjects = deleteObjectsQuietly as unknown as Mock;
const keyInUse = isFileKeyInUse as unknown as Mock;
const owns = ownsCollections as unknown as Mock;
const favoriteQuery = setItemFavoriteQuery as unknown as Mock;
const pinQuery = setItemPinnedQuery as unknown as Mock;
const revalidate = revalidatePath as unknown as Mock;

const USER_ID = "user_1";

const card = {
  id: "item_1",
  title: "Title",
  description: null,
  fileName: null,
  fileSize: null,
  url: null,
  isPinned: false,
  isFavorite: false,
  updatedAt: new Date(1),
  type: { slug: "snippet", name: "Snippet", color: null },
  collections: [],
};
const detail = { content: "body", url: null, fileName: null, language: null, createdAt: new Date(0), tags: [] };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  query.mockResolvedValue({ card, detail });
  deleteQuery.mockResolvedValue({ fileUrl: null });
  head.mockResolvedValue(null);
  deleteObjects.mockResolvedValue(undefined);
  createQuery.mockResolvedValue(card);
  keyInUse.mockResolvedValue(false);
  owns.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateItem", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await updateItem("item_1", { title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty title", { title: "", tags: [], collectionIds: [] }, "Title is required.", "title"],
    ["a title of only spaces", { title: "   ", tags: [], collectionIds: [] }, "Title is required.", "title"],
    ["an invalid URL", { title: "Link", url: "not a url", tags: [], collectionIds: [] }, "Enter a valid URL.", "url"],
    ["an empty tag", { title: "Title", tags: ["bash", " "], collectionIds: [] }, "Tags cannot be empty.", "tags"],
    ["a title over 200 characters", { title: "a".repeat(201), tags: [], collectionIds: [] }, "Title can be at most 200 characters.", "title"],
    [
      "a description over 2,000 characters",
      { title: "Title", description: "a".repeat(2_001), tags: [], collectionIds: [] },
      "Description can be at most 2,000 characters.",
      "description",
    ],
    [
      "content over 100,000 characters",
      { title: "Title", content: "a".repeat(100_001), tags: [], collectionIds: [] },
      "Content can be at most 100,000 characters.",
      "content",
    ],
    ["a language over 50 characters", { title: "Title", language: "a".repeat(51), tags: [], collectionIds: [] }, "Language can be at most 50 characters.", "language"],
    ["a tag over 50 characters", { title: "Title", tags: ["a".repeat(51)], collectionIds: [] }, "Each tag can be at most 50 characters.", "tags"],
    [
      "more than 20 tags",
      { title: "Title", tags: Array.from({ length: 21 }, (_, i) => `tag${i}`), collectionIds: [] },
      "An item can have at most 20 tags.",
      "tags",
    ],
  ])("rejects %s before reaching the database, naming the field", async (_name, input, error, field) => {
    const result = await updateItem("item_1", input);

    expect(result).toEqual({ success: false, data: null, error, field });
    expect(session).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("updates the item as the signed-in user, with the input trimmed", async () => {
    await updateItem("item_1", {
      title: "  Title ",
      description: " About ",
      url: " https://example.com ",
      tags: [" bash ", "ci"], collectionIds: [],
    });

    expect(query).toHaveBeenCalledWith(USER_ID, "item_1", {
      title: "Title",
      description: "About",
      url: "https://example.com",
      tags: ["bash", "ci"], collectionIds: [],
    });
  });

  it("keeps the content exactly as typed, since indentation and newlines are part of code", async () => {
    await updateItem("item_1", { title: "Title", content: "  indented\n\n", tags: [], collectionIds: [] });

    expect(query.mock.calls[0]![2].content).toBe("  indented\n\n");
  });

  it("clears content of only whitespace", async () => {
    await updateItem("item_1", { title: "Title", content: " \n ", tags: [], collectionIds: [] });

    expect(query.mock.calls[0]![2].content).toBeNull();
  });

  it("clears a field left blank, and leaves out the fields not sent", async () => {
    await updateItem("item_1", { title: "Title", description: "  ", url: "", tags: [], collectionIds: [] });

    const data = query.mock.calls[0]![2];
    expect(data).toMatchObject({ description: null, url: null });
    expect(data.content).toBeUndefined();
    expect(data.language).toBeUndefined();
  });

  it("returns the card and the detail, with the date as the drawer receives it", async () => {
    const result = await updateItem("item_1", { title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({
      success: true,
      data: { card, detail: { ...detail, createdAt: new Date(0).toISOString() } },
      error: null,
    });
  });

  it("reports an item that does not exist or is not the user's", async () => {
    query.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    const result = await updateItem("someone_elses", { title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "This item no longer exists." });
  });

  it("reports any other failure without the details", async () => {
    query.mockRejectedValue(new Error("connection lost"));

    const result = await updateItem("item_1", { title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "Could not save the item. Try again." });
  });
});

describe("createItem", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await createItem({ type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty title", { type: "note", title: " ", tags: [], collectionIds: [] }, "Title is required.", "title"],
    ["a link without a URL", { type: "link", title: "Docs", tags: [], collectionIds: [] }, "URL is required.", "url"],
    ["a link with a blank URL", { type: "link", title: "Docs", url: "  ", tags: [], collectionIds: [] }, "URL is required.", "url"],
    ["a link with an invalid URL", { type: "link", title: "Docs", url: "nope", tags: [], collectionIds: [] }, "Enter a valid URL.", "url"],
    ["an empty tag", { type: "note", title: "Title", tags: ["a", " "], collectionIds: [] }, "Tags cannot be empty.", "tags"],
    ["a file without an upload", { type: "file", title: "Title", tags: [], collectionIds: [] }, "Choose a file to upload.", "fileKey"],
    ["an image with a blank key", { type: "image", title: "Title", fileKey: "", tags: [], collectionIds: [] }, "Choose a file to upload.", "fileKey"],
    ["an unknown type", { type: "custom", title: "Title", tags: [], collectionIds: [] }, "Choose a type.", "type"],
    ["a title over 200 characters", { type: "note", title: "a".repeat(201), tags: [], collectionIds: [] }, "Title can be at most 200 characters.", "title"],
    [
      "more than 20 tags",
      { type: "note", title: "Title", tags: Array.from({ length: 21 }, (_, i) => `tag${i}`), collectionIds: [] },
      "An item can have at most 20 tags.",
      "tags",
    ],
    [
      "a snippet language over 50 characters",
      { type: "snippet", title: "Title", language: "a".repeat(51), tags: [], collectionIds: [] },
      "Language can be at most 50 characters.",
      "language",
    ],
  ])("rejects %s before reaching the database, naming the field", async (_name, input, error, field) => {
    const result = await createItem(input as Parameters<typeof createItem>[0]);

    expect(result).toEqual({ success: false, data: null, error, field });
    expect(session).not.toHaveBeenCalled();
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("creates the item as the signed-in user, with the input trimmed", async () => {
    await createItem({
      type: "snippet",
      title: "  Title ",
      description: " About ",
      content: "  const a = 1;\n",
      language: " ts ",
      tags: [" react ", "hooks"], collectionIds: [],
    });

    expect(createQuery).toHaveBeenCalledWith(USER_ID, {
      type: "snippet",
      title: "Title",
      description: "About",
      content: "  const a = 1;\n",
      language: "ts",
      tags: ["react", "hooks"], collectionIds: [],
    });
  });

  it("creates a link with its URL", async () => {
    await createItem({ type: "link", title: "Docs", url: " https://example.com ", tags: [], collectionIds: [] });

    expect(createQuery.mock.calls[0]![1]).toMatchObject({ type: "link", url: "https://example.com" });
  });

  it("drops the fields the type does not use", async () => {
    await createItem({
      type: "note",
      title: "Title",
      content: "body",
      language: "ts",
      url: "https://example.com",
      tags: [], collectionIds: [],
      // Not part of the input type, as a tampered request might send it.
      ...({ userId: "someone_else" } as object),
    });

    const data = createQuery.mock.calls[0]![1];
    expect(data).toEqual({ type: "note", title: "Title", content: "body", tags: [], collectionIds: [] });
  });

  it.each([
    ["snippet", ["content", "language"]],
    ["command", ["content", "language"]],
    ["prompt", ["content"]],
    ["note", ["content"]],
    ["link", ["url"]],
  ] as const)("keeps only the fields a %s uses", async (type, kept) => {
    await createItem({
      type,
      title: "Title",
      content: "body",
      language: "bash",
      url: "https://example.com",
      tags: [], collectionIds: [],
    });

    const data = createQuery.mock.calls[0]![1];
    for (const field of ["content", "language", "url"] as const) {
      expect(field in data).toBe((kept as readonly string[]).includes(field));
    }
  });

  it("stores blank fields as null", async () => {
    await createItem({ type: "snippet", title: "Title", description: " ", content: " \n ", language: "", tags: [], collectionIds: [] });

    expect(createQuery.mock.calls[0]![1]).toMatchObject({ description: null, content: null, language: null });
  });

  it("returns the new card", async () => {
    const result = await createItem({ type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: true, data: card, error: null });
  });

  it("reports a failure without the details", async () => {
    createQuery.mockRejectedValue(new Error("connection lost"));

    const result = await createItem({ type: "note", title: "Title", tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "Could not create the item. Try again." });
  });
});

describe("collections on an item", () => {
  const UNKNOWN = "One of the chosen collections no longer exists. Choose again.";

  it("passes the chosen collections through once each, after checking they are the user's", async () => {
    await updateItem("item_1", { title: "Title", tags: [], collectionIds: ["col_a", "col_b", "col_a"] });

    expect(owns).toHaveBeenCalledWith(USER_ID, ["col_a", "col_b"]);
    expect(query.mock.calls[0]![2].collectionIds).toEqual(["col_a", "col_b"]);
  });

  it("creates an item in the chosen collections", async () => {
    await createItem({ type: "note", title: "Title", tags: [], collectionIds: ["col_a"] });

    expect(owns).toHaveBeenCalledWith(USER_ID, ["col_a"]);
    expect(createQuery.mock.calls[0]![1].collectionIds).toEqual(["col_a"]);
  });

  it("refuses a collection that is not the user's on update, naming the field", async () => {
    owns.mockResolvedValue(false);

    const result = await updateItem("item_1", { title: "Title", tags: [], collectionIds: ["someone_elses"] });

    expect(result).toEqual({ success: false, data: null, error: UNKNOWN, field: "collectionIds" });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses a collection that is not the user's on create, naming the field", async () => {
    owns.mockResolvedValue(false);

    const result = await createItem({ type: "note", title: "Title", tags: [], collectionIds: ["someone_elses"] });

    expect(result).toEqual({ success: false, data: null, error: UNKNOWN, field: "collectionIds" });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("deletes an unused upload when a chosen collection is refused", async () => {
    owns.mockResolvedValue(false);
    const fileKey = `${USER_ID}/0f8fad5b-d9cb-469f-a165-70867728950e/report.pdf`;

    await createItem({ type: "file", title: "Report", fileKey, tags: [], collectionIds: ["someone_elses"] });

    expect(deleteObjects).toHaveBeenCalledWith([fileKey]);
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("rejects more than 20 collections before reaching the database", async () => {
    const collectionIds = Array.from({ length: 21 }, (_, i) => `col_${i}`);

    const result = await updateItem("item_1", { title: "Title", tags: [], collectionIds });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "An item can be in at most 20 collections.",
      field: "collectionIds",
    });
    expect(session).not.toHaveBeenCalled();
  });

  it("refuses an input without the collections", async () => {
    const result = await updateItem("item_1", { title: "Title", tags: [] } as never);

    expect(result).toMatchObject({ success: false, field: "collectionIds" });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("createItem with an upload", () => {
  const KEY = `${USER_ID}/0f8fad5b-d9cb-469f-a165-70867728950e/report.pdf`;
  const NOT_FOUND = "The uploaded file was not found. Upload it again.";

  beforeEach(() => {
    head.mockResolvedValue({ size: 2048, metadata: { kind: "file", name: encodeURIComponent("Rapport été.pdf") } });
  });

  it("stores the key with the name and size R2 reports, not the browser's", async () => {
    const result = await createItem({
      type: "file",
      title: " Report ",
      fileKey: KEY,
      tags: [], collectionIds: [],
      // Not part of the input, as a tampered request might send them.
      ...({ fileSize: 1, fileName: "fake.pdf" } as object),
    });

    expect(head).toHaveBeenCalledWith(KEY);
    expect(createQuery).toHaveBeenCalledWith(USER_ID, {
      type: "file",
      title: "Report",
      tags: [], collectionIds: [],
      contentType: "file",
      fileUrl: KEY,
      fileName: "Rapport été.pdf",
      fileSize: 2048,
    });
    expect(result).toEqual({ success: true, data: card, error: null });
  });

  it.each([
    ["another user's key", `user_2/0f8fad5b-d9cb-469f-a165-70867728950e/report.pdf`],
    ["a key that climbs out of the user's folder", `${USER_ID}/../user_2/report.pdf`],
    ["a key the server did not build", `${USER_ID}/report.pdf`],
  ])("refuses %s without asking R2", async (_name, fileKey) => {
    const result = await createItem({ type: "file", title: "Report", fileKey, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND, field: "fileKey" });
    expect(head).not.toHaveBeenCalled();
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a key with nothing behind it in R2", async () => {
    head.mockResolvedValue(null);

    const result = await createItem({ type: "file", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND, field: "fileKey" });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a file uploaded as the other kind and deletes the unused upload", async () => {
    const result = await createItem({ type: "image", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND, field: "fileKey" });
    expect(createQuery).not.toHaveBeenCalled();
    expect(keyInUse).toHaveBeenCalledWith(USER_ID, KEY);
    expect(deleteObjects).toHaveBeenCalledWith([KEY]);
  });

  it("keeps the object when the refused key is an existing item's", async () => {
    keyInUse.mockResolvedValue(true);

    const result = await createItem({ type: "image", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND, field: "fileKey" });
    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it("deletes nothing when the key has nothing behind it", async () => {
    head.mockResolvedValue(null);

    await createItem({ type: "file", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(keyInUse).not.toHaveBeenCalled();
    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it("deletes the upload when the item cannot be saved", async () => {
    createQuery.mockRejectedValue(new Error("connection lost"));

    const result = await createItem({ type: "file", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "Could not create the item. Try again." });
    expect(deleteObjects).toHaveBeenCalledWith([KEY]);
  });

  it("refuses when not signed in, before looking at the key", async () => {
    session.mockResolvedValue(null);

    const result = await createItem({ type: "file", title: "Report", fileKey: KEY, tags: [], collectionIds: [] });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(head).not.toHaveBeenCalled();
  });
});

describe("deleteItem", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it("deletes the item as the signed-in user", async () => {
    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: true, data: null, error: null });
    expect(deleteQuery).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it("deletes the item's file from R2 too", async () => {
    deleteQuery.mockResolvedValue({ fileUrl: "user_1/key/report.pdf" });

    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: true, data: null, error: null });
    expect(deleteObjects).toHaveBeenCalledWith(["user_1/key/report.pdf"]);
  });

  it("reports an item that is missing or another user's as gone", async () => {
    deleteQuery.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: false, data: null, error: "This item no longer exists." });
  });

  it("hides an unexpected database error behind a generic message", async () => {
    deleteQuery.mockRejectedValue(new Error("connection lost"));

    const result = await deleteItem("item_1");

    expect(result).toEqual({ success: false, data: null, error: "Could not delete the item. Try again." });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("setItemFavorite", () => {
  beforeEach(() => {
    favoriteQuery.mockResolvedValue(true);
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await setItemFavorite("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(favoriteQuery).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses a value that is not a boolean", async () => {
    const result = await setItemFavorite("item_1", "yes" as unknown as boolean);

    expect(result).toEqual({ success: false, data: null, error: "Invalid favorite value." });
    expect(favoriteQuery).not.toHaveBeenCalled();
  });

  it("favorites the item as the signed-in user and refreshes the layout", async () => {
    const result = await setItemFavorite("item_1", true);

    expect(result).toEqual({ success: true, data: { isFavorite: true }, error: null });
    expect(favoriteQuery).toHaveBeenCalledWith(USER_ID, "item_1", true);
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("unfavorites the item", async () => {
    const result = await setItemFavorite("item_1", false);

    expect(result).toEqual({ success: true, data: { isFavorite: false }, error: null });
    expect(favoriteQuery).toHaveBeenCalledWith(USER_ID, "item_1", false);
  });

  it("reports an item that is missing or another user's as gone", async () => {
    favoriteQuery.mockResolvedValue(false);

    const result = await setItemFavorite("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "This item no longer exists." });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("hides an unexpected database error behind a generic message", async () => {
    favoriteQuery.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await setItemFavorite("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "Could not update the favorite. Try again." });
  });
});

describe("setItemPinned", () => {
  beforeEach(() => {
    pinQuery.mockResolvedValue(true);
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await setItemPinned("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(pinQuery).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses a value that is not a boolean", async () => {
    const result = await setItemPinned("item_1", "yes" as unknown as boolean);

    expect(result).toEqual({ success: false, data: null, error: "Invalid pin value." });
    expect(pinQuery).not.toHaveBeenCalled();
  });

  it("pins the item as the signed-in user and refreshes the layout", async () => {
    const result = await setItemPinned("item_1", true);

    expect(result).toEqual({ success: true, data: { isPinned: true }, error: null });
    expect(pinQuery).toHaveBeenCalledWith(USER_ID, "item_1", true);
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("unpins the item", async () => {
    const result = await setItemPinned("item_1", false);

    expect(result).toEqual({ success: true, data: { isPinned: false }, error: null });
    expect(pinQuery).toHaveBeenCalledWith(USER_ID, "item_1", false);
  });

  it("reports an item that is missing or another user's as gone", async () => {
    pinQuery.mockResolvedValue(false);

    const result = await setItemPinned("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "This item no longer exists." });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("hides an unexpected database error behind a generic message", async () => {
    pinQuery.mockRejectedValue(new Error("connection lost"));

    const result = await setItemPinned("item_1", true);

    expect(result).toEqual({ success: false, data: null, error: "Could not update the pin. Try again." });
  });
});

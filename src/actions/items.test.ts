import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createItem, deleteItem, updateItem } from "@/actions/items";
import { auth } from "@/auth";
import {
  createItem as createItemQuery,
  deleteItem as deleteItemQuery,
  updateItem as updateItemQuery,
} from "@/lib/db/items";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn() }));

const session = auth as unknown as Mock;
const query = updateItemQuery as unknown as Mock;
const deleteQuery = deleteItemQuery as unknown as Mock;
const createQuery = createItemQuery as unknown as Mock;

const USER_ID = "user_1";

const card = {
  id: "item_1",
  title: "Title",
  description: null,
  fileSize: null,
  isPinned: false,
  isFavorite: false,
  updatedAt: new Date(1),
  type: { slug: "snippet", name: "Snippet", color: null },
  collectionName: null,
};
const detail = { content: "body", url: null, fileName: null, language: null, createdAt: new Date(0), tags: [] };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  query.mockResolvedValue({ card, detail });
  deleteQuery.mockResolvedValue(undefined);
  createQuery.mockResolvedValue(card);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateItem", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await updateItem("item_1", { title: "Title", tags: [] });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty title", { title: "", tags: [] }, "Title is required.", "title"],
    ["a title of only spaces", { title: "   ", tags: [] }, "Title is required.", "title"],
    ["an invalid URL", { title: "Link", url: "not a url", tags: [] }, "Enter a valid URL.", "url"],
    ["an empty tag", { title: "Title", tags: ["bash", " "] }, "Tags cannot be empty.", "tags"],
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
      tags: [" bash ", "ci"],
    });

    expect(query).toHaveBeenCalledWith(USER_ID, "item_1", {
      title: "Title",
      description: "About",
      url: "https://example.com",
      tags: ["bash", "ci"],
    });
  });

  it("keeps the content exactly as typed, since indentation and newlines are part of code", async () => {
    await updateItem("item_1", { title: "Title", content: "  indented\n\n", tags: [] });

    expect(query.mock.calls[0]![2].content).toBe("  indented\n\n");
  });

  it("clears content of only whitespace", async () => {
    await updateItem("item_1", { title: "Title", content: " \n ", tags: [] });

    expect(query.mock.calls[0]![2].content).toBeNull();
  });

  it("clears a field left blank, and leaves out the fields not sent", async () => {
    await updateItem("item_1", { title: "Title", description: "  ", url: "", tags: [] });

    const data = query.mock.calls[0]![2];
    expect(data).toMatchObject({ description: null, url: null });
    expect(data.content).toBeUndefined();
    expect(data.language).toBeUndefined();
  });

  it("returns the card and the detail, with the date as the drawer receives it", async () => {
    const result = await updateItem("item_1", { title: "Title", tags: [] });

    expect(result).toEqual({
      success: true,
      data: { card, detail: { ...detail, createdAt: new Date(0).toISOString() } },
      error: null,
    });
  });

  it("reports an item that does not exist or is not the user's", async () => {
    query.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    const result = await updateItem("someone_elses", { title: "Title", tags: [] });

    expect(result).toEqual({ success: false, data: null, error: "This item no longer exists." });
  });

  it("reports any other failure without the details", async () => {
    query.mockRejectedValue(new Error("connection lost"));

    const result = await updateItem("item_1", { title: "Title", tags: [] });

    expect(result).toEqual({ success: false, data: null, error: "Could not save the item. Try again." });
  });
});

describe("createItem", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await createItem({ type: "note", title: "Title", tags: [] });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty title", { type: "note", title: " ", tags: [] }, "Title is required.", "title"],
    ["a link without a URL", { type: "link", title: "Docs", tags: [] }, "URL is required.", "url"],
    ["a link with a blank URL", { type: "link", title: "Docs", url: "  ", tags: [] }, "URL is required.", "url"],
    ["a link with an invalid URL", { type: "link", title: "Docs", url: "nope", tags: [] }, "Enter a valid URL.", "url"],
    ["an empty tag", { type: "note", title: "Title", tags: ["a", " "] }, "Tags cannot be empty.", "tags"],
    ["the file type", { type: "file", title: "Title", tags: [] }, "Choose a type.", "type"],
    ["the image type", { type: "image", title: "Title", tags: [] }, "Choose a type.", "type"],
    ["an unknown type", { type: "custom", title: "Title", tags: [] }, "Choose a type.", "type"],
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
      tags: [" react ", "hooks"],
    });

    expect(createQuery).toHaveBeenCalledWith(USER_ID, {
      type: "snippet",
      title: "Title",
      description: "About",
      content: "  const a = 1;\n",
      language: "ts",
      tags: ["react", "hooks"],
    });
  });

  it("creates a link with its URL", async () => {
    await createItem({ type: "link", title: "Docs", url: " https://example.com ", tags: [] });

    expect(createQuery.mock.calls[0]![1]).toMatchObject({ type: "link", url: "https://example.com" });
  });

  it("drops the fields the type does not use", async () => {
    await createItem({
      type: "note",
      title: "Title",
      content: "body",
      language: "ts",
      url: "https://example.com",
      tags: [],
      // Not part of the input type, as a tampered request might send it.
      ...({ userId: "someone_else" } as object),
    });

    const data = createQuery.mock.calls[0]![1];
    expect(data).toEqual({ type: "note", title: "Title", content: "body", tags: [] });
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
      tags: [],
    });

    const data = createQuery.mock.calls[0]![1];
    for (const field of ["content", "language", "url"] as const) {
      expect(field in data).toBe((kept as readonly string[]).includes(field));
    }
  });

  it("stores blank fields as null", async () => {
    await createItem({ type: "snippet", title: "Title", description: " ", content: " \n ", language: "", tags: [] });

    expect(createQuery.mock.calls[0]![1]).toMatchObject({ description: null, content: null, language: null });
  });

  it("returns the new card", async () => {
    const result = await createItem({ type: "note", title: "Title", tags: [] });

    expect(result).toEqual({ success: true, data: card, error: null });
  });

  it("reports a failure without the details", async () => {
    createQuery.mockRejectedValue(new Error("connection lost"));

    const result = await createItem({ type: "note", title: "Title", tags: [] });

    expect(result).toEqual({ success: false, data: null, error: "Could not create the item. Try again." });
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

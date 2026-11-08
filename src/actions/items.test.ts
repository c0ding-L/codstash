import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { deleteItem, updateItem } from "@/actions/items";
import { auth } from "@/auth";
import { deleteItem as deleteItemQuery, updateItem as updateItemQuery } from "@/lib/db/items";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ updateItem: vi.fn(), deleteItem: vi.fn() }));

const session = auth as unknown as Mock;
const query = updateItemQuery as unknown as Mock;
const deleteQuery = deleteItemQuery as unknown as Mock;

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

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createCollection, deleteCollection, setCollectionFavorite, updateCollection } from "@/actions/collections";
import { auth } from "@/auth";
import {
  createCollection as createCollectionQuery,
  deleteCollection as deleteCollectionQuery,
  setCollectionFavorite as setCollectionFavoriteQuery,
  updateCollection as updateCollectionQuery,
} from "@/lib/db/collections";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setCollectionFavorite: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const session = auth as unknown as Mock;
const createQuery = createCollectionQuery as unknown as Mock;
const updateQuery = updateCollectionQuery as unknown as Mock;
const deleteQuery = deleteCollectionQuery as unknown as Mock;
const revalidate = revalidatePath as unknown as Mock;
const favoriteQuery = setCollectionFavoriteQuery as unknown as Mock;
const redirectTo = redirect as unknown as Mock;

/** Prisma's error when the row to update or delete does not exist (or is not the user's). */
const notFound = Object.assign(new Error("Record not found"), { code: "P2025" });

const USER_ID = "user_1";

const card = {
  id: "col_1",
  name: "React",
  description: "Hooks and patterns",
  isFavorite: false,
  itemCount: 0,
  updatedAt: new Date(1),
  types: [],
};

describe("createCollection", () => {
  beforeEach(() => {
    session.mockResolvedValue({ user: { id: USER_ID } });
    createQuery.mockResolvedValue(card);
  });

  it("creates the collection for the session's user", async () => {
    const result = await createCollection({ name: "  React  ", description: "Hooks and patterns" });

    expect(result).toEqual({ success: true, data: card, error: null });
    expect(createQuery).toHaveBeenCalledWith(USER_ID, { name: "React", description: "Hooks and patterns" });
  });

  it("stores a blank description as null", async () => {
    await createCollection({ name: "React", description: "   " });

    expect(createQuery).toHaveBeenCalledWith(USER_ID, { name: "React", description: null });
  });

  it("refuses a blank name and marks the field", async () => {
    const result = await createCollection({ name: "   " });

    expect(result).toEqual({ success: false, data: null, error: "Name is required.", field: "name" });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a name over the cap", async () => {
    const result = await createCollection({ name: "a".repeat(101) });

    expect(result).toMatchObject({ success: false, field: "name" });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a description over the cap", async () => {
    const result = await createCollection({ name: "React", description: "a".repeat(2_001) });

    expect(result).toMatchObject({ success: false, field: "description" });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("ignores a userId sent from the client", async () => {
    await createCollection({ name: "React", userId: "someone_else" } as never);

    expect(createQuery).toHaveBeenCalledWith(USER_ID, { name: "React" });
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await createCollection({ name: "React" });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("returns a generic error when the query fails", async () => {
    createQuery.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCollection({ name: "React" });

    expect(result).toEqual({ success: false, data: null, error: "Could not create the collection. Try again." });
  });
});

describe("updateCollection", () => {
  const summary = { id: "col_1", name: "React", description: null, isFavorite: false };

  beforeEach(() => {
    session.mockResolvedValue({ user: { id: USER_ID } });
    updateQuery.mockResolvedValue(summary);
  });

  it("updates the session user's collection with the trimmed fields", async () => {
    const result = await updateCollection("col_1", { name: "  React  ", description: "  " });

    expect(result).toEqual({ success: true, data: summary, error: null });
    expect(updateQuery).toHaveBeenCalledWith(USER_ID, "col_1", { name: "React", description: null });
  });

  it("refuses a blank name and marks the field", async () => {
    const result = await updateCollection("col_1", { name: "" });

    expect(result).toEqual({ success: false, data: null, error: "Name is required.", field: "name" });
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it("refuses a description over the cap", async () => {
    const result = await updateCollection("col_1", { name: "React", description: "a".repeat(2_001) });

    expect(result).toMatchObject({ success: false, field: "description" });
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await updateCollection("col_1", { name: "React" });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it("reports another user's or a missing collection as gone", async () => {
    updateQuery.mockRejectedValue(notFound);

    const result = await updateCollection("col_other", { name: "React" });

    expect(result).toEqual({ success: false, data: null, error: "This collection no longer exists." });
  });

  it("returns a generic error when the query fails", async () => {
    updateQuery.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateCollection("col_1", { name: "React" });

    expect(result).toEqual({ success: false, data: null, error: "Could not save the collection. Try again." });
  });
});

describe("deleteCollection", () => {
  beforeEach(() => {
    session.mockResolvedValue({ user: { id: USER_ID } });
    deleteQuery.mockResolvedValue(undefined);
  });

  it("deletes the session user's collection and stays put by default", async () => {
    const result = await deleteCollection("col_1");

    expect(result).toEqual({ success: true, data: null, error: null });
    expect(deleteQuery).toHaveBeenCalledWith(USER_ID, "col_1");
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("revalidates and redirects to the list when asked, from the collection's own page", async () => {
    await deleteCollection("col_1", { redirectToList: true });

    expect(deleteQuery).toHaveBeenCalledWith(USER_ID, "col_1");
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
    expect(redirectTo).toHaveBeenCalledWith("/collections");
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await deleteCollection("col_1", { redirectToList: true });

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(deleteQuery).not.toHaveBeenCalled();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("reports another user's or a missing collection as gone, without redirecting", async () => {
    deleteQuery.mockRejectedValue(notFound);

    const result = await deleteCollection("col_other", { redirectToList: true });

    expect(result).toEqual({ success: false, data: null, error: "This collection no longer exists." });
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("returns a generic error when the query fails", async () => {
    deleteQuery.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteCollection("col_1");

    expect(result).toEqual({ success: false, data: null, error: "Could not delete the collection. Try again." });
  });
});

describe("setCollectionFavorite", () => {
  beforeEach(() => {
    session.mockResolvedValue({ user: { id: USER_ID } });
    favoriteQuery.mockResolvedValue(true);
  });

  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    const result = await setCollectionFavorite("col_1", true);

    expect(result).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(favoriteQuery).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses a value that is not a boolean", async () => {
    const result = await setCollectionFavorite("col_1", 1 as unknown as boolean);

    expect(result).toEqual({ success: false, data: null, error: "Invalid favorite value." });
    expect(favoriteQuery).not.toHaveBeenCalled();
  });

  it("favorites the collection as the signed-in user and refreshes the layout", async () => {
    const result = await setCollectionFavorite("col_1", true);

    expect(result).toEqual({ success: true, data: { isFavorite: true }, error: null });
    expect(favoriteQuery).toHaveBeenCalledWith(USER_ID, "col_1", true);
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("unfavorites the collection", async () => {
    const result = await setCollectionFavorite("col_1", false);

    expect(result).toEqual({ success: true, data: { isFavorite: false }, error: null });
    expect(favoriteQuery).toHaveBeenCalledWith(USER_ID, "col_1", false);
  });

  it("reports a collection that is missing or another user's as gone", async () => {
    favoriteQuery.mockResolvedValue(false);

    const result = await setCollectionFavorite("col_1", true);

    expect(result).toEqual({ success: false, data: null, error: "This collection no longer exists." });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("hides an unexpected database error behind a generic message", async () => {
    favoriteQuery.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await setCollectionFavorite("col_1", true);

    expect(result).toEqual({ success: false, data: null, error: "Could not update the favorite. Try again." });
  });
});

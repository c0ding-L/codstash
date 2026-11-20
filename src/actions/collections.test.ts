import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createCollection } from "@/actions/collections";
import { auth } from "@/auth";
import { createCollection as createCollectionQuery } from "@/lib/db/collections";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ createCollection: vi.fn() }));

const session = auth as unknown as Mock;
const createQuery = createCollectionQuery as unknown as Mock;

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

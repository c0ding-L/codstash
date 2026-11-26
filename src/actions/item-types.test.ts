import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";

import { createItemType, deleteItemType, updateItemType } from "@/actions/item-types";
import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import {
  createCustomType,
  deleteCustomType,
  isCustomTypeNameTaken,
  updateCustomType,
} from "@/lib/db/item-types";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({
  MAX_CUSTOM_TYPES: 20,
  createCustomType: vi.fn(),
  updateCustomType: vi.fn(),
  deleteCustomType: vi.fn(),
  isCustomTypeNameTaken: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = auth as unknown as Mock;
const planStatus = getPlanStatus as unknown as Mock;
const createQuery = createCustomType as unknown as Mock;
const updateQuery = updateCustomType as unknown as Mock;
const deleteQuery = deleteCustomType as unknown as Mock;
const nameTaken = isCustomTypeNameTaken as unknown as Mock;
const revalidate = revalidatePath as unknown as Mock;

const USER_ID = "user_1";
const plan = (isPro: boolean) => ({ proUntil: null, isPro, items: 0, collections: 0 });
const INPUT = { name: " Problème ", icon: "bug", color: "brown", template: "## Steps\n" };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue(plan(true));
  nameTaken.mockResolvedValue(false);
  createQuery.mockResolvedValue({ id: "typ_1", slug: "probleme" });
  updateQuery.mockResolvedValue({ id: "typ_1", slug: "probleme" });
  deleteQuery.mockResolvedValue({ deleted: true });
});

const prismaError = (code: string) => Object.assign(new Error(code), { code });

describe("createItemType", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    expect(await createItemType(INPUT)).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a Free account with the Pro message", async () => {
    planStatus.mockResolvedValue(plan(false));

    expect(await createItemType(INPUT)).toEqual({
      success: false,
      data: null,
      error: "Custom item types are a Pro feature.",
    });
    expect(createQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty name", { ...INPUT, name: "  " }, "Name is required.", "name"],
    ["a name over 40 characters", { ...INPUT, name: "a".repeat(41) }, "Name can be at most 40 characters.", "name"],
    ["a name with no letters or digits", { ...INPUT, name: "+++" }, "Use at least two letters or digits in the name.", "name"],
    ["a reserved name", { ...INPUT, name: "Snippets" }, "This name is reserved. Choose another.", "name"],
    ["a reserved word", { ...INPUT, name: "New" }, "This name is reserved. Choose another.", "name"],
    ["an unknown icon", { ...INPUT, icon: "skull" }, "Choose an icon from the list.", "icon"],
    ["an unknown colour", { ...INPUT, color: "pink" }, "Choose a color from the list.", "color"],
    ["a system type's colour", { ...INPUT, color: "emerald" }, "Choose a color from the list.", "color"],
    [
      "a template over 10,000 characters",
      { ...INPUT, template: "a".repeat(10_001) },
      "Template can be at most 10,000 characters.",
      "template",
    ],
  ])("rejects %s before reaching the database, naming the field", async (_name, input, error, field) => {
    expect(await createItemType(input)).toEqual({ success: false, data: null, error, field });
    expect(session).not.toHaveBeenCalled();
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("refuses a name the user already has, ignoring case", async () => {
    nameTaken.mockResolvedValue(true);

    expect(await createItemType(INPUT)).toEqual({
      success: false,
      data: null,
      error: "You already have a type with this name.",
      field: "name",
    });
    expect(nameTaken).toHaveBeenCalledWith(USER_ID, "Problème", undefined);
    expect(createQuery).not.toHaveBeenCalled();
  });

  it("answers a slug clash (P2002) as a taken name", async () => {
    createQuery.mockRejectedValue(prismaError("P2002"));

    expect(await createItemType(INPUT)).toMatchObject({ success: false, field: "name" });
  });

  it("refuses past 20 types", async () => {
    createQuery.mockRejectedValue(new LimitReachedError("customTypes"));

    expect(await createItemType(INPUT)).toEqual({
      success: false,
      data: null,
      error: "You can have at most 20 custom types.",
    });
  });

  it("creates the type with the name trimmed and the slug from it, then refreshes the layout", async () => {
    const result = await createItemType(INPUT);

    expect(result).toEqual({ success: true, data: { id: "typ_1", slug: "probleme" }, error: null });
    expect(createQuery).toHaveBeenCalledWith(USER_ID, {
      name: "Problème",
      slug: "probleme",
      icon: "bug",
      color: "brown",
      template: "## Steps\n",
    });
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("stores a blank template as none", async () => {
    await createItemType({ ...INPUT, template: "  \n" });

    expect(createQuery.mock.calls[0]![1].template).toBeNull();
  });

  it("answers in French", async () => {
    setTestLocale("fr");
    planStatus.mockResolvedValue(plan(false));

    expect((await createItemType(INPUT)).error).toBe("Les types d’éléments personnalisés sont réservés à la formule Pro.");
  });
});

describe("updateItemType", () => {
  it("refuses a Free account, even one whose Pro lapsed", async () => {
    planStatus.mockResolvedValue(plan(false));

    expect((await updateItemType("typ_1", INPUT)).error).toBe("Custom item types are a Pro feature.");
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it("checks the name against the user's other types only", async () => {
    await updateItemType("typ_1", INPUT);

    expect(nameTaken).toHaveBeenCalledWith(USER_ID, "Problème", "typ_1");
  });

  // The query filters on the owner and `isSystem: false`, so another user's type throws P2025.
  it("answers another user's type, or a missing one, as not found", async () => {
    updateQuery.mockRejectedValue(prismaError("P2025"));

    expect(await updateItemType("someone_elses", INPUT)).toEqual({
      success: false,
      data: null,
      error: "This type no longer exists.",
    });
  });

  it("saves the new name and slug as the signed-in user", async () => {
    const result = await updateItemType("typ_1", { ...INPUT, name: "Bug report" });

    expect(result.success).toBe(true);
    expect(updateQuery).toHaveBeenCalledWith(USER_ID, "typ_1", expect.objectContaining({ name: "Bug report", slug: "bug-report" }));
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });
});

describe("deleteItemType", () => {
  it("refuses when not signed in", async () => {
    session.mockResolvedValue(null);

    expect((await deleteItemType("typ_1")).error).toBe("You are not signed in.");
    expect(deleteQuery).not.toHaveBeenCalled();
  });

  it("answers another user's type as not found", async () => {
    deleteQuery.mockResolvedValue(null);

    expect((await deleteItemType("someone_elses")).error).toBe("This type no longer exists.");
    expect(deleteQuery).toHaveBeenCalledWith(USER_ID, "someone_elses");
  });

  it("refuses while items still use the type, with their count", async () => {
    deleteQuery.mockResolvedValue({ deleted: false, itemCount: 3 });

    expect((await deleteItemType("typ_1")).error).toBe("3 items still use this type. Delete them first.");
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses when an item was added meanwhile (P2003)", async () => {
    deleteQuery.mockRejectedValue(prismaError("P2003"));

    expect((await deleteItemType("typ_1")).error).toBe("Items still use this type. Delete them first.");
  });

  // Not gated on Pro: after a lapse, the user can still remove an empty type.
  it("deletes an empty type, Free or Pro, and refreshes the layout", async () => {
    planStatus.mockResolvedValue(plan(false));

    expect(await deleteItemType("typ_1")).toEqual({ success: true, data: null, error: null });
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });
});

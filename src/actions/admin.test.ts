import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";

import { deleteUserAccount, grantProToUser, revokeProFromUser } from "@/actions/admin";
import { auth } from "@/auth";
import { findAdminTarget, grantPro, isAdminUser, revokePro } from "@/lib/db/admin";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { deleteUserAndData } from "@/lib/db/delete-user";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  findAdminTarget: vi.fn(),
  grantPro: vi.fn(),
  isAdminUser: vi.fn(),
  revokePro: vi.fn(),
}));
vi.mock("@/lib/db/collections", () => ({ DEMO_USER_EMAIL: "demo@devstash.io" }));
vi.mock("@/lib/db/delete-user", () => ({ deleteUserAndData: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const isAdmin = asMock(isAdminUser);
const target = asMock(findAdminTarget);

const ADMIN = "admin_1";
const OTHER = { id: "user_2", email: "ada@example.com", role: "USER" };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: ADMIN, role: "ADMIN" } });
  isAdmin.mockResolvedValue(true);
  target.mockResolvedValue(OTHER);
  asMock(grantPro).mockResolvedValue(new Date("2027-01-01T00:00:00Z"));
  asMock(revokePro).mockResolvedValue(true);
});

describe("admin gate", () => {
  it("refuses a signed-out caller", async () => {
    session.mockResolvedValue(null);
    expect(await grantProToUser({ userId: OTHER.id, days: 30 })).toEqual({ success: false, error: "You are not signed in." });
    expect(grantPro).not.toHaveBeenCalled();
  });

  it("refuses a non-admin, from the database even when the session claims ADMIN", async () => {
    isAdmin.mockResolvedValue(false);
    const refused = { success: false, error: "Only an admin can do this." };

    expect(await grantProToUser({ userId: OTHER.id, days: 30 })).toEqual(refused);
    expect(await revokeProFromUser({ userId: OTHER.id })).toEqual(refused);
    expect(await deleteUserAccount({ userId: OTHER.id })).toEqual(refused);
    expect(isAdmin).toHaveBeenCalledWith(ADMIN);
    expect(grantPro).not.toHaveBeenCalled();
    expect(revokePro).not.toHaveBeenCalled();
    expect(deleteUserAndData).not.toHaveBeenCalled();
  });
});

describe("grantProToUser", () => {
  it("grants the days and refreshes /admin", async () => {
    expect(await grantProToUser({ userId: OTHER.id, days: 30 })).toEqual({ success: true, error: null });
    expect(grantPro).toHaveBeenCalledWith(OTHER.id, 30);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it.each([0, -5, 1.5, 3651, Number.NaN])("refuses %s days", async (days) => {
    expect(await grantProToUser({ userId: OTHER.id, days })).toMatchObject({ success: false });
    expect(grantPro).not.toHaveBeenCalled();
  });

  it("says so when the account is gone", async () => {
    asMock(grantPro).mockResolvedValue(null);
    expect(await grantProToUser({ userId: OTHER.id, days: 30 })).toEqual({
      success: false,
      error: "This account no longer exists.",
    });
  });

  it("answers a database failure with a retry message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    asMock(grantPro).mockRejectedValue(new Error("connection lost"));
    expect(await grantProToUser({ userId: OTHER.id, days: 30 })).toEqual({
      success: false,
      error: "Could not grant Pro access. Try again.",
    });
  });
});

describe("revokeProFromUser", () => {
  it("ends Pro", async () => {
    expect(await revokeProFromUser({ userId: OTHER.id })).toEqual({ success: true, error: null });
    expect(revokePro).toHaveBeenCalledWith(OTHER.id);
  });

  it("says so when the account is gone", async () => {
    asMock(revokePro).mockResolvedValue(false);
    expect(await revokeProFromUser({ userId: OTHER.id })).toMatchObject({ error: "This account no longer exists." });
  });
});

describe("deleteUserAccount", () => {
  it("deletes another user's account", async () => {
    expect(await deleteUserAccount({ userId: OTHER.id })).toEqual({ success: true, error: null });
    expect(deleteUserAndData).toHaveBeenCalledWith(OTHER);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("never deletes the caller", async () => {
    target.mockResolvedValue({ id: ADMIN, email: "me@example.com", role: "ADMIN" });
    expect(await deleteUserAccount({ userId: ADMIN })).toEqual({
      success: false,
      error: "An admin account cannot be deleted from the admin panel.",
    });
    expect(deleteUserAndData).not.toHaveBeenCalled();
  });

  it("never deletes another admin", async () => {
    target.mockResolvedValue({ ...OTHER, role: "ADMIN" });
    expect(await deleteUserAccount({ userId: OTHER.id })).toMatchObject({ success: false });
    expect(deleteUserAndData).not.toHaveBeenCalled();
  });

  it("never deletes the demo account", async () => {
    target.mockResolvedValue({ ...OTHER, email: DEMO_USER_EMAIL });
    expect(await deleteUserAccount({ userId: OTHER.id })).toEqual({
      success: false,
      error: "The demo account cannot be deleted.",
    });
    expect(deleteUserAndData).not.toHaveBeenCalled();
  });

  it("says so when the account is gone", async () => {
    target.mockResolvedValue(null);
    expect(await deleteUserAccount({ userId: OTHER.id })).toMatchObject({ error: "This account no longer exists." });
  });
});

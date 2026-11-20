import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { changePassword, deleteAccount, type ActionResult } from "@/actions/profile";
import { auth, signIn, signOut } from "@/auth";
import { getItemFileKeys } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteObjectsQuietly } from "@/lib/r2";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  // The real `redirect` throws too, and nothing after it may run.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));
vi.mock("@/lib/db/items", () => ({ getItemFileKeys: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObjectsQuietly: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    item: { deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
  },
}));

const INITIAL: ActionResult = { success: false, error: null };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

// Prisma's overloads are generic, so the mocks are reached through this plain shape.
const asMock = (fn: unknown) => fn as Mock;
const findUser = asMock(prisma.user.findUnique);
const compare = asMock(bcrypt.compare);
const hash = asMock(bcrypt.hash);
const session = asMock(auth);
const transaction = asMock(prisma.$transaction);
const rateLimit = asMock(checkRateLimit);

const USER = { id: "user_1", email: "Ada@Example.com", password: "stored-hash" };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER.id } });
  rateLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() });
  findUser.mockResolvedValue(USER);
  compare.mockResolvedValue(true);
  hash.mockResolvedValue("new-hash");
  vi.spyOn(console, "error").mockImplementation(() => {});
  asMock(getItemFileKeys).mockResolvedValue(["user_1/a/notes.pdf"]);
  asMock(deleteObjectsQuietly).mockResolvedValue(undefined);

  // Each write returns a marker, so a test can check what went into `$transaction`
  // and in which order. A write made outside it would be missing from the array.
  asMock(prisma.user.update).mockReturnValue("update-user");
  asMock(prisma.user.delete).mockReturnValue("delete-user");
  asMock(prisma.item.deleteMany).mockReturnValue("delete-items");
  asMock(prisma.verificationToken.deleteMany).mockReturnValue("delete-tokens");
});

describe("changePassword", () => {
  const valid = { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" };

  it.each([
    [{ ...valid, currentPassword: "" }, "Enter your current password."],
    [{ ...valid, newPassword: "short", confirmPassword: "short" }, "New password must be at least 8 characters."],
    [{ ...valid, confirmPassword: "different" }, "Passwords do not match."],
  ])("rejects invalid input before reading the session: %j", async (fields, error) => {
    expect(await changePassword(INITIAL, form(fields))).toEqual({ success: false, error });
    expect(auth).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    session.mockResolvedValue(null);

    expect(await changePassword(INITIAL, form(valid))).toEqual({ success: false, error: "You are not signed in." });
  });

  it("refuses an account with no password", async () => {
    findUser.mockResolvedValue({ ...USER, password: null });

    const result = await changePassword(INITIAL, form(valid));

    expect(result.error).toBe("This account has no password to change.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("stops before checking the password once the re-auth limit is hit", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 10 * 60_000 });

    const result = await changePassword(INITIAL, form(valid));

    expect(rateLimit).toHaveBeenCalledWith("reauth", USER.id);
    expect(result).toEqual({ success: false, error: "Too many attempts. Please try again in 10 minutes." });
    expect(compare).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("changes nothing when the current password is wrong", async () => {
    compare.mockResolvedValue(false);

    const result = await changePassword(INITIAL, form(valid));

    expect(compare).toHaveBeenCalledWith(valid.currentPassword, USER.password);
    expect(result.error).toBe("Current password is incorrect.");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stores the hash, ends other sessions, revokes reset links and signs back in", async () => {
    await expect(changePassword(INITIAL, form(valid))).rejects.toThrow("REDIRECT /profile?passwordChanged=1");

    expect(hash).toHaveBeenCalledWith(valid.newPassword, 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER.id },
      data: { password: "new-hash", passwordChangedAt: expect.any(Date) },
    });
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "reset@ada@example.com" },
    });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(["update-user", "delete-tokens"]);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: USER.email,
      password: valid.newPassword,
      redirect: false,
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("answers generically when the database fails", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

    const result = await changePassword(INITIAL, form(valid));

    expect(result).toEqual({ success: false, error: "Could not change the password. Try again." });
    expect(signIn).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signs out when signing back in fails", async () => {
    vi.mocked(signIn).mockRejectedValue(new Error("sign-in failed"));

    await expect(changePassword(INITIAL, form(valid))).rejects.toThrow("REDIRECT");

    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });
});

describe("deleteAccount", () => {
  const confirm = { confirmEmail: "ada@example.com", password: "correct-password" };

  it("asks for the email before reading the session", async () => {
    const result = await deleteAccount(INITIAL, form({ confirmEmail: "   " }));

    expect(result.error).toBe("Type your email to confirm.");
    expect(auth).not.toHaveBeenCalled();
  });

  it("stops before checking the password once the re-auth limit is hit", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    const result = await deleteAccount(INITIAL, form(confirm));

    expect(rateLimit).toHaveBeenCalledWith("reauth", USER.id);
    expect(result).toEqual({ success: false, error: "Too many attempts. Please try again in 1 minute." });
    expect(compare).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    session.mockResolvedValue(null);

    expect((await deleteAccount(INITIAL, form(confirm))).error).toBe("You are not signed in.");
  });

  it("refuses when the account is already gone", async () => {
    findUser.mockResolvedValue(null);

    expect((await deleteAccount(INITIAL, form(confirm))).error).toBe("This account no longer exists.");
  });

  it("protects the demo account", async () => {
    findUser.mockResolvedValue({ id: "demo", email: "demo@codstash.io" });

    const result = await deleteAccount(INITIAL, form({ confirmEmail: "demo@codstash.io" }));

    expect(result.error).toBe("The demo account cannot be deleted.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes nothing when the email does not match", async () => {
    const result = await deleteAccount(INITIAL, form({ confirmEmail: "other@example.com" }));

    expect(result.error).toBe("The email does not match your account.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("deletes nothing when the password is wrong", async () => {
    compare.mockResolvedValue(false);

    const result = await deleteAccount(INITIAL, form(confirm));

    expect(compare).toHaveBeenCalledWith(confirm.password, USER.password);
    expect(result).toEqual({ success: false, error: "Password is incorrect." });
    expect(transaction).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  // Someone posting to the action directly can leave the field out altogether.
  it.each([
    ["missing", { confirmEmail: confirm.confirmEmail }],
    ["empty", { ...confirm, password: "" }],
  ])("deletes nothing when the password is %s", async (_label, fields) => {
    const result = await deleteAccount(INITIAL, form(fields));

    expect(result.error).toBe("Password is incorrect.");
    expect(compare).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("asks a GitHub-only account for its email alone", async () => {
    findUser.mockResolvedValue({ ...USER, password: null });

    const result = await deleteAccount(INITIAL, form({ confirmEmail: confirm.confirmEmail }));

    expect(compare).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, error: null });
  });

  it("deletes the session user's data, whatever the email's case, and signs out", async () => {
    const result = await deleteAccount(INITIAL, form({ ...confirm, confirmEmail: "  ADA@example.COM " }));

    expect(prisma.item.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id } });
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: ["ada@example.com", "reset@ada@example.com"] } },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: USER.id } });
    // Items first: `Item.typeId` is `Restrict`, so the user's custom types can't go before them.
    expect(transaction).toHaveBeenCalledExactlyOnceWith(["delete-items", "delete-tokens", "delete-user"]);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
    expect(result).toEqual({ success: true, error: null });
  });

  it("deletes the user's uploaded files from R2 once the data is gone", async () => {
    await deleteAccount(INITIAL, form(confirm));

    expect(getItemFileKeys).toHaveBeenCalledWith(USER.id);
    expect(deleteObjectsQuietly).toHaveBeenCalledWith(["user_1/a/notes.pdf"]);
    expect(asMock(deleteObjectsQuietly).mock.invocationCallOrder[0]).toBeGreaterThan(
      transaction.mock.invocationCallOrder[0]!,
    );
  });

  it("stays signed in when the database fails", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

    const result = await deleteAccount(INITIAL, form(confirm));

    expect(result).toEqual({ success: false, error: "Could not delete the account. Try again." });
    expect(signOut).not.toHaveBeenCalled();
    // The items are still there, so their files must stay too.
    expect(deleteObjectsQuietly).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetEmail, isPasswordResetTokenValid, resetPassword } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/verification";

// `@/lib/verification` imports this module too, so it needs both senders.
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const send = asMock(sendPasswordResetEmail);
const transaction = asMock(prisma.$transaction);
const findLatestToken = asMock(prisma.verificationToken.findFirst);
const findToken = asMock(prisma.verificationToken.findUnique);
const createToken = asMock(prisma.verificationToken.create);
const deleteTokens = asMock(prisma.verificationToken.deleteMany);
const findUser = asMock(prisma.user.findUnique);
const updateUser = asMock(prisma.user.update);

const NOW = Date.parse("2026-08-15T12:00:00.000Z");
const SECOND = 1000;
const TTL = 60 * 60 * SECOND;

const RESET_IDENTIFIER = "reset@ada@example.com";

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("APP_URL", "https://codstash.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  send.mockResolvedValue(true);
  findLatestToken.mockResolvedValue(null);
  createToken.mockReturnValue("create-token");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("issuePasswordResetEmail", () => {
  const user = { email: "Ada@Example.com", name: "Ada" };

  it("fails without APP_URL, before writing anything", async () => {
    vi.stubEnv("APP_URL", "");

    expect(await issuePasswordResetEmail(user)).toBe("failed");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("stores only the hash, under its own identifier, valid for an hour", async () => {
    deleteTokens.mockReturnValue("delete-tokens");

    expect(await issuePasswordResetEmail(user)).toBe("sent");

    const link = new URL(send.mock.calls[0]![0].url);
    const token = link.searchParams.get("token")!;

    expect(`${link.origin}${link.pathname}`).toBe("https://codstash.test/reset-password");
    expect(link.searchParams.get("email")).toBe("ada@example.com");
    // Under the bare email, it would delete and collide with verification tokens.
    expect(deleteTokens).toHaveBeenCalledWith({ where: { identifier: RESET_IDENTIFIER } });
    expect(createToken).toHaveBeenCalledWith({
      data: { identifier: RESET_IDENTIFIER, token: hashToken(token), expires: new Date(NOW + TTL) },
    });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(["delete-tokens", "create-token"]);
  });

  it("blocks a token issued under a minute ago", async () => {
    findLatestToken.mockResolvedValue({ expires: new Date(NOW - 59 * SECOND + TTL) });

    expect(await issuePasswordResetEmail(user)).toBe("throttled");
    expect(transaction).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("allows a new one after a minute", async () => {
    findLatestToken.mockResolvedValue({ expires: new Date(NOW - 60 * SECOND + TTL) });

    expect(await issuePasswordResetEmail(user)).toBe("sent");
  });

  it("removes the token when the email fails, so a retry isn't throttled", async () => {
    send.mockResolvedValue(false);

    expect(await issuePasswordResetEmail(user)).toBe("failed");
    expect(deleteTokens).toHaveBeenLastCalledWith({ where: { identifier: RESET_IDENTIFIER } });
  });
});

describe("isPasswordResetTokenValid", () => {
  it("looks the token up by its hash, for that email", async () => {
    findToken.mockResolvedValue({ expires: new Date(NOW + 1) });

    expect(await isPasswordResetTokenValid(" Ada@Example.com ", "raw-token")).toBe(true);
    expect(findToken).toHaveBeenCalledWith({
      where: { identifier_token: { identifier: RESET_IDENTIFIER, token: hashToken("raw-token") } },
    });
  });

  it("rejects an unknown token", async () => {
    findToken.mockResolvedValue(null);

    expect(await isPasswordResetTokenValid("ada@example.com", "bad-token")).toBe(false);
  });

  it.each([
    ["at the moment it expires", NOW],
    ["after it expires", NOW - 1],
  ])("rejects a token %s", async (_label, expires) => {
    findToken.mockResolvedValue({ expires: new Date(expires) });

    expect(await isPasswordResetTokenValid("ada@example.com", "raw-token")).toBe(false);
  });

  // Mail scanners open links, which must not use them up.
  it("does not consume the token", async () => {
    findToken.mockResolvedValue({ expires: new Date(NOW + 1) });

    await isPasswordResetTokenValid("ada@example.com", "raw-token");

    expect(deleteTokens).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  const user = { id: "user_1", password: "old-hash", emailVerified: new Date(0) };

  beforeEach(() => {
    updateUser.mockReturnValue("update-user");
    findUser.mockResolvedValue(user);
    // The first call consumes the reset token, and the second is inside the transaction.
    deleteTokens.mockResolvedValueOnce({ count: 1 }).mockReturnValueOnce("delete-verification-tokens");
  });

  it("consumes only a matching, unexpired token for that email", async () => {
    expect(await resetPassword(" Ada@Example.com ", "raw-token", "new-hash")).toBe(true);

    // Expiry is enforced by this filter, so an expired token matches no row.
    expect(deleteTokens).toHaveBeenNthCalledWith(1, {
      where: { identifier: RESET_IDENTIFIER, token: hashToken("raw-token"), expires: { gt: new Date(NOW) } },
    });
    expect(findUser).toHaveBeenCalledWith({ where: { email: "ada@example.com" } });
  });

  it("sets the password, ends older sessions and drops verification tokens together", async () => {
    await resetPassword("ada@example.com", "raw-token", "new-hash");

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { password: "new-hash", passwordChangedAt: new Date(NOW) },
    });
    expect(deleteTokens).toHaveBeenNthCalledWith(2, { where: { identifier: "ada@example.com" } });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(["update-user", "delete-verification-tokens"]);
  });

  it("marks an unverified account verified, since the link proves the inbox", async () => {
    findUser.mockResolvedValue({ ...user, emailVerified: null });

    await resetPassword("ada@example.com", "raw-token", "new-hash");

    expect(updateUser.mock.calls[0]![0].data.emailVerified).toEqual(new Date(NOW));
  });

  it("changes nothing for a token that matches no row: unknown, expired or reused", async () => {
    deleteTokens.mockReset();
    deleteTokens.mockResolvedValue({ count: 0 });

    expect(await resetPassword("ada@example.com", "bad-token", "new-hash")).toBe(false);
    expect(findUser).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["a GitHub-only account", { ...user, password: null }],
    ["an account that is gone", null],
  ])("sets no password on %s", async (_label, found) => {
    findUser.mockResolvedValue(found);

    expect(await resetPassword("ada@example.com", "raw-token", "new-hash")).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });
});

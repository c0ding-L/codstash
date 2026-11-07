import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { hashToken, issueVerificationEmail, verifyEmailToken } from "@/lib/verification";

vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const send = asMock(sendVerificationEmail);
const transaction = asMock(prisma.$transaction);
const findToken = asMock(prisma.verificationToken.findFirst);
const createToken = asMock(prisma.verificationToken.create);
const deleteTokens = asMock(prisma.verificationToken.deleteMany);
const findUser = asMock(prisma.user.findUnique);
const updateUser = asMock(prisma.user.update);

const NOW = Date.parse("2026-08-15T12:00:00.000Z");
const SECOND = 1000;
const TTL = 24 * 60 * 60 * SECOND;

/** A token row issued this long ago: the issue time is `expires - TTL`. */
const issuedAgo = (ms: number) => ({ expires: new Date(NOW - ms + TTL) });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("APP_URL", "https://codstash.test/");
  vi.spyOn(console, "error").mockImplementation(() => {});
  send.mockResolvedValue(true);
  createToken.mockReturnValue("create-token");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("hashToken", () => {
  it("is the SHA-256 hex digest", () => {
    expect(hashToken("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("issueVerificationEmail", () => {
  const user = { email: "Ada@Example.com", name: "Ada" };

  it("fails without APP_URL, before writing anything", async () => {
    vi.stubEnv("APP_URL", "");

    expect(await issueVerificationEmail(user)).toBe("failed");
    expect(transaction).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("replaces earlier tokens and stores only the hash, valid for a day", async () => {
    deleteTokens.mockReturnValue("delete-tokens");

    expect(await issueVerificationEmail(user)).toBe("sent");

    const { to, name, url } = send.mock.calls[0]![0];
    const link = new URL(url);
    const token = link.searchParams.get("token")!;

    expect(`${link.origin}${link.pathname}`).toBe("https://codstash.test/verify-email");
    expect(link.searchParams.get("email")).toBe("ada@example.com");
    expect({ to, name }).toEqual({ to: "ada@example.com", name: "Ada" });

    expect(deleteTokens).toHaveBeenCalledWith({ where: { identifier: "ada@example.com" } });
    expect(createToken).toHaveBeenCalledWith({
      data: { identifier: "ada@example.com", token: hashToken(token), expires: new Date(NOW + TTL) },
    });
    expect(hashToken(token)).not.toBe(token);
    expect(transaction).toHaveBeenCalledExactlyOnceWith(["delete-tokens", "create-token"]);
  });

  it("issues a different token each time", async () => {
    await issueVerificationEmail(user);
    await issueVerificationEmail(user);

    const [first, second] = send.mock.calls.map(([{ url }]) => new URL(url).searchParams.get("token"));
    expect(first).not.toBe(second);
  });

  it("removes the token when the email fails, so a retry isn't throttled", async () => {
    send.mockResolvedValue(false);

    expect(await issueVerificationEmail(user)).toBe("failed");
    expect(deleteTokens).toHaveBeenLastCalledWith({ where: { identifier: "ada@example.com" } });
  });

  describe("with the throttle", () => {
    it("blocks a token issued under a minute ago", async () => {
      findToken.mockResolvedValue(issuedAgo(59 * SECOND));

      expect(await issueVerificationEmail(user, { throttle: true })).toBe("throttled");
      expect(findToken).toHaveBeenCalledWith({
        where: { identifier: "ada@example.com" },
        orderBy: { expires: "desc" },
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it("allows a new one after a minute", async () => {
      findToken.mockResolvedValue(issuedAgo(60 * SECOND));

      expect(await issueVerificationEmail(user, { throttle: true })).toBe("sent");
    });

    it("allows the first one", async () => {
      findToken.mockResolvedValue(null);

      expect(await issueVerificationEmail(user, { throttle: true })).toBe("sent");
    });
  });

  it("does not check the throttle by default", async () => {
    await issueVerificationEmail(user);

    expect(findToken).not.toHaveBeenCalled();
  });
});

describe("verifyEmailToken", () => {
  const unverified = { id: "user_1", emailVerified: null };

  it("consumes only a matching, unexpired token for that email", async () => {
    deleteTokens.mockResolvedValue({ count: 1 });
    findUser.mockResolvedValue(unverified);

    expect(await verifyEmailToken("  Ada@Example.com ", "raw-token")).toBe(true);

    // Expiry is enforced by this filter, so an expired token matches no row.
    expect(deleteTokens).toHaveBeenCalledWith({
      where: { identifier: "ada@example.com", token: hashToken("raw-token"), expires: { gt: new Date(NOW) } },
    });
    expect(updateUser).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { emailVerified: new Date(NOW) } });
  });

  it("rejects a token that matches no row: unknown, expired or for another email", async () => {
    deleteTokens.mockResolvedValue({ count: 0 });

    expect(await verifyEmailToken("ada@example.com", "bad-token")).toBe(false);
    expect(findUser).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("works only once", async () => {
    deleteTokens.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    findUser.mockResolvedValue(unverified);

    expect(await verifyEmailToken("ada@example.com", "raw-token")).toBe(true);
    expect(await verifyEmailToken("ada@example.com", "raw-token")).toBe(false);
    expect(updateUser).toHaveBeenCalledOnce();
  });

  it("rejects a valid token when the account is gone", async () => {
    deleteTokens.mockResolvedValue({ count: 1 });
    findUser.mockResolvedValue(null);

    expect(await verifyEmailToken("ada@example.com", "raw-token")).toBe(false);
  });

  it("keeps the original date on an account that is already verified", async () => {
    deleteTokens.mockResolvedValue({ count: 1 });
    findUser.mockResolvedValue({ id: "user_1", emailVerified: new Date(0) });

    expect(await verifyEmailToken("ada@example.com", "raw-token")).toBe(true);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

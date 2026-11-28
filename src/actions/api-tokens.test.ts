import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";

import { plan, pro } from "@/lib/__fixtures__/plan";
import { createApiToken, revokeApiToken } from "@/actions/api-tokens";
import { auth } from "@/auth";
import { hashToken } from "@/lib/api-token";
import { createApiTokenRow, revokeApiTokenRow, type NewApiTokenData } from "@/lib/db/api-tokens";
import { getPlanStatus } from "@/lib/db/billing";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/api-tokens", () => ({
  MAX_API_TOKENS: 10,
  createApiTokenRow: vi.fn(),
  revokeApiTokenRow: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = auth as unknown as Mock;
const planStatus = getPlanStatus as unknown as Mock;
const createRow = createApiTokenRow as unknown as Mock;
const revokeRow = revokeApiTokenRow as unknown as Mock;
const revalidate = revalidatePath as unknown as Mock;

const USER_ID = "user_1";
const DAY = 24 * 60 * 60 * 1000;
const INPUT = { name: "  Laptop CLI ", scope: "read" as const, expiry: "90d" as const };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue(plan());
  createRow.mockImplementation(async (_userId: string, data: NewApiTokenData) => ({
    id: "tok_1",
    name: data.name,
    prefix: data.prefix,
    scope: data.scope,
    createdAt: new Date(),
    lastUsedAt: null,
    expiresAt: data.expiresAt,
    expired: false,
  }));
  revokeRow.mockResolvedValue(true);
});

describe("createApiToken", () => {
  it("creates a read token on Free and returns the token once, matching the stored hash", async () => {
    const result = await createApiToken(INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [userId, data] = createRow.mock.calls[0] as [string, NewApiTokenData];
    expect(userId).toBe(USER_ID);
    expect(data.name).toBe("Laptop CLI");
    expect(data.scope).toBe("read");
    expect(result.data.token).toMatch(/^cstash_[A-Za-z0-9_-]{43}$/);
    expect(data.hash).toBe(hashToken(result.data.token));
    expect(data.prefix).toBe(result.data.token.slice(0, 12));
    expect(JSON.stringify(data)).not.toContain(result.data.token);
    expect(result.data.summary).not.toHaveProperty("hash");
    expect(revalidate).toHaveBeenCalledWith("/settings");
  });

  it.each([
    ["30d", 30],
    ["90d", 90],
    ["1y", 365],
  ] as const)("sets the expiry for %s", async (expiry, days) => {
    const before = Date.now();
    await createApiToken({ ...INPUT, expiry });
    const [, data] = createRow.mock.calls[0] as [string, NewApiTokenData];
    const expected = before + days * DAY;
    expect(data.expiresAt!.getTime()).toBeGreaterThanOrEqual(expected);
    expect(data.expiresAt!.getTime()).toBeLessThan(expected + 5000);
  });

  it("creates a token that never expires", async () => {
    await createApiToken({ ...INPUT, expiry: "never" });
    expect((createRow.mock.calls[0] as [string, NewApiTokenData])[1].expiresAt).toBeNull();
  });

  it("refuses a write token on Free", async () => {
    const result = await createApiToken({ ...INPUT, scope: "write" });
    expect(result).toEqual({
      success: false,
      data: null,
      error: "Read + write API tokens are a Pro feature.",
      field: "scope",
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it("creates a write token on Pro", async () => {
    planStatus.mockResolvedValue(pro());
    const result = await createApiToken({ ...INPUT, scope: "write" });
    expect(result.success).toBe(true);
    expect((createRow.mock.calls[0] as [string, NewApiTokenData])[1].scope).toBe("write");
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);
    const result = await createApiToken(INPUT);
    expect(result).toMatchObject({ success: false, error: "You are not signed in." });
    expect(createRow).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty name", { ...INPUT, name: "   " }, "name", "Name is required."],
    ["a name over 50 characters", { ...INPUT, name: "x".repeat(51) }, "name", "Name can be at most 50 characters."],
    ["an unknown scope", { ...INPUT, scope: "admin" }, "scope", "Choose an access level from the list."],
    ["an unknown expiry", { ...INPUT, expiry: "5y" }, "expiry", "Choose an expiry from the list."],
  ])("rejects %s", async (_case, input, field, error) => {
    const result = await createApiToken(input as typeof INPUT);
    expect(result).toEqual({ success: false, data: null, error, field });
    expect(session).not.toHaveBeenCalled();
  });

  it("answers the cap of 10 active tokens", async () => {
    createRow.mockRejectedValue(new LimitReachedError("apiTokens"));
    const result = await createApiToken(INPUT);
    expect(result).toMatchObject({
      success: false,
      error: "You can have at most 10 active API tokens. Revoke one first.",
    });
  });

  it("answers in French", async () => {
    setTestLocale("fr");
    createRow.mockRejectedValue(new LimitReachedError("apiTokens"));
    const result = await createApiToken(INPUT);
    expect(result.success).toBe(false);
    expect(result.error).not.toContain("You can have");
  });

  it("logs a failure without the token", async () => {
    createRow.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createApiToken(INPUT);
    expect(result).toMatchObject({ success: false, error: "Could not create the token. Try again." });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/cstash_/);
    log.mockRestore();
  });
});

describe("revokeApiToken", () => {
  it("revokes the user's own token", async () => {
    expect(await revokeApiToken("tok_1")).toEqual({ success: true, data: null, error: null });
    expect(revokeRow).toHaveBeenCalledWith(USER_ID, "tok_1");
    expect(revalidate).toHaveBeenCalledWith("/settings");
  });

  it("answers not found for another user's, a missing or a revoked token", async () => {
    revokeRow.mockResolvedValue(false);
    expect(await revokeApiToken("tok_other")).toEqual({
      success: false,
      data: null,
      error: "This token no longer exists.",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("answers not found for an empty id without a query", async () => {
    expect((await revokeApiToken("")).success).toBe(false);
    expect(revokeRow).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);
    expect(await revokeApiToken("tok_1")).toMatchObject({ success: false, error: "You are not signed in." });
    expect(revokeRow).not.toHaveBeenCalled();
  });
});

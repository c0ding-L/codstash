import { after } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { authenticateApi } from "@/lib/api-auth";
import { generateToken } from "@/lib/api-token";
import { findApiTokenByHash, touchApiToken, type ApiTokenLookup } from "@/lib/db/api-tokens";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/db/api-tokens", () => ({ findApiTokenByHash: vi.fn(), touchApiToken: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;

const DAY = 24 * 60 * 60 * 1000;
const { token, hash } = generateToken();

function row(overrides: Partial<ApiTokenLookup> = {}): ApiTokenLookup {
  return {
    id: "tok1",
    userId: "user1",
    scope: "write",
    expiresAt: null,
    revokedAt: null,
    user: { proUntil: new Date(Date.now() + 30 * DAY) },
    ...overrides,
  };
}

function request(authorization?: string) {
  return new Request("http://localhost/api/v1/items", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

beforeEach(() => {
  asMock(findApiTokenByHash).mockResolvedValue(row());
  asMock(touchApiToken).mockResolvedValue(true);
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 100, reset: Date.now() });
});

describe("authenticateApi", () => {
  it("returns the caller for a valid token and looks it up by hash", async () => {
    const result = await authenticateApi(request(`Bearer ${token}`), "write");
    expect(result).toEqual({ userId: "user1", tokenId: "tok1", scope: "write", isPro: true });
    expect(findApiTokenByHash).toHaveBeenCalledWith(hash);
  });

  it("lets a read token read, even on Free", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ scope: "read", user: { proUntil: null } }));
    expect(await authenticateApi(request(`Bearer ${token}`), "read")).toEqual({
      userId: "user1",
      tokenId: "tok1",
      scope: "read",
      isPro: false,
    });
  });

  describe("401 invalid_token, the same answer every time", () => {
    const cases: [string, () => Request][] = [
      ["no header", () => request()],
      ["a malformed header", () => request("Bearer nope")],
      [
        "an unknown token",
        () => {
          asMock(findApiTokenByHash).mockResolvedValue(null);
          return request(`Bearer ${token}`);
        },
      ],
      [
        "a revoked token",
        () => {
          asMock(findApiTokenByHash).mockResolvedValue(row({ revokedAt: new Date() }));
          return request(`Bearer ${token}`);
        },
      ],
      [
        "an expired token",
        () => {
          asMock(findApiTokenByHash).mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }));
          return request(`Bearer ${token}`);
        },
      ],
    ];

    it.each(cases)("for %s", async (_case, build) => {
      const result = await authenticateApi(build(), "read");
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(await response.text()).toBe(
        JSON.stringify({
          error: { code: "invalid_token", message: "The API token is missing, invalid, revoked or expired." },
        }),
      );
      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
    });
  });

  it("accepts a token that expires later", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ expiresAt: new Date(Date.now() + DAY) }));
    expect(await authenticateApi(request(`Bearer ${token}`), "read")).not.toBeInstanceOf(Response);
  });

  it("refuses a read token for a write with 403 insufficient_scope", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ scope: "read" }));
    const response = (await authenticateApi(request(`Bearer ${token}`), "write")) as Response;
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("insufficient_scope");
  });

  it("treats an unknown scope as read-only", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ scope: "admin" }));
    const response = (await authenticateApi(request(`Bearer ${token}`), "write")) as Response;
    expect((await response.json()).error.code).toBe("insufficient_scope");
  });

  it("refuses a write once Pro has lapsed, with 403 pro_required", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ user: { proUntil: new Date(Date.now() - DAY) } }));
    const response = (await authenticateApi(request(`Bearer ${token}`), "write")) as Response;
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("pro_required");
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("still lets a lapsed write token read", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(row({ user: { proUntil: null } }));
    expect(await authenticateApi(request(`Bearer ${token}`), "read")).toEqual({
      userId: "user1",
      tokenId: "tok1",
      scope: "write",
      isPro: false,
    });
  });

  it("rate limits per token and answers 429 with Retry-After", async () => {
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 30_000 });
    const response = (await authenticateApi(request(`Bearer ${token}`), "read")) as Response;
    expect(checkRateLimit).toHaveBeenCalledWith("api", "tok1");
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(29);
    expect((await response.json()).error.code).toBe("rate_limited");
    expect(after).not.toHaveBeenCalled();
  });

  it("counts writes against apiWrite too", async () => {
    asMock(checkRateLimit).mockImplementation(async (name: string) =>
      name === "apiWrite"
        ? { success: false, remaining: 0, reset: Date.now() + 10_000 }
        : { success: true, remaining: 100, reset: Date.now() },
    );
    const response = (await authenticateApi(request(`Bearer ${token}`), "write")) as Response;
    expect(checkRateLimit).toHaveBeenCalledWith("apiWrite", "tok1");
    expect(response.status).toBe(429);
  });

  it("does not count reads against apiWrite", async () => {
    await authenticateApi(request(`Bearer ${token}`), "read");
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("records the use after the response, and a failure there is only logged", async () => {
    await authenticateApi(request(`Bearer ${token}`), "read");
    expect(touchApiToken).not.toHaveBeenCalled();
    const [[task]] = asMock(after).mock.calls as [[() => Promise<void>]];

    asMock(touchApiToken).mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(task()).resolves.toBeUndefined();
    expect(touchApiToken).toHaveBeenCalledWith("tok1");
    expect(log.mock.calls[0][0]).toContain("tok1");
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    log.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/v1/me/route";
import { apiRequest, invalidToken, readCaller, USER_ID } from "@/lib/__fixtures__/api-v1";
import { authenticateApi } from "@/lib/api-auth";
import { getApiMe } from "@/lib/db/api-items";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  authenticateApi: vi.fn(),
}));
vi.mock("@/lib/db/api-items", () => ({ getApiMe: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const auth = asMock(authenticateApi);
const me = asMock(getApiMe);

const getMe = () => GET(apiRequest("/me"));

beforeEach(() => auth.mockResolvedValue(readCaller));

describe("GET /api/v1/me", () => {
  it("answers 401 without a valid token", async () => {
    auth.mockResolvedValue(invalidToken());
    const response = await getMe();

    expect(response.status).toBe(401);
    expect(me).not.toHaveBeenCalled();
  });

  it("returns the token owner with ISO dates, never cached", async () => {
    const limits = { items: { used: 3, max: null }, collections: { used: 1, max: null } };
    me.mockResolvedValue({ id: USER_ID, name: "Ada", email: "ada@example.com", isPro: true, proUntil: new Date("2027-01-01T00:00:00.000Z"), limits });

    const response = await getMe();

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "read");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: { id: USER_ID, name: "Ada", email: "ada@example.com", isPro: true, proUntil: "2027-01-01T00:00:00.000Z", limits },
    });
  });

  it("answers 404 when the account is gone", async () => {
    me.mockResolvedValue(null);
    expect((await getMe()).status).toBe(404);
  });
});

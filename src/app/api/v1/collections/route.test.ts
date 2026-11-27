import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/v1/collections/route";
import { apiRequest, invalidToken, readCaller, USER_ID } from "@/lib/__fixtures__/api-v1";
import { authenticateApi } from "@/lib/api-auth";
import { listApiCollections } from "@/lib/db/api-items";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  authenticateApi: vi.fn(),
}));
vi.mock("@/lib/db/api-items", () => ({ listApiCollections: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const auth = asMock(authenticateApi);
const list = asMock(listApiCollections);

beforeEach(() => auth.mockResolvedValue(readCaller));

describe("GET /api/v1/collections", () => {
  it("answers 401 without a valid token", async () => {
    auth.mockResolvedValue(invalidToken());
    expect((await GET(apiRequest("/collections"))).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("lists the caller's collections", async () => {
    const collections = [{ id: "c1", name: "Utils", description: null, itemCount: 3 }];
    list.mockResolvedValue(collections);

    const response = await GET(apiRequest("/collections"));

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "read");
    expect(list).toHaveBeenCalledWith(USER_ID);
    expect(await response.json()).toEqual({ data: collections });
  });

  it("answers 500 in C1's error shape when the query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    list.mockRejectedValue(new Error("db down"));

    const response = await GET(apiRequest("/collections"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "internal_error", message: expect.any(String) } });
  });
});

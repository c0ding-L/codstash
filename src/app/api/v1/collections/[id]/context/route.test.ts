import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/v1/collections/[id]/context/route";
import { apiRequest, invalidToken, params, readCaller, USER_ID } from "@/lib/__fixtures__/api-v1";
import { authenticateApi } from "@/lib/api-auth";
import { getCollectionContextData } from "@/lib/db/context-export";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  authenticateApi: vi.fn(),
}));
vi.mock("@/lib/db/context-export", () => ({ getCollectionContextData: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const auth = asMock(authenticateApi);
const contextData = asMock(getCollectionContextData);

const getContext = (id = "c1") => GET(apiRequest(`/collections/${id}/context`), params(id));

beforeEach(() => {
  auth.mockResolvedValue(readCaller);
  contextData.mockResolvedValue({ collection: { name: "React hooks", description: "Hooks I reuse." }, items: [] });
});

describe("GET /api/v1/collections/[id]/context", () => {
  it("answers 401 without a valid token", async () => {
    auth.mockResolvedValue(invalidToken());
    expect((await getContext()).status).toBe(401);
    expect(contextData).not.toHaveBeenCalled();
  });

  it("returns the collection as Markdown", async () => {
    const response = await getContext();

    expect(auth).toHaveBeenCalledWith(expect.any(Request), "read");
    expect(contextData).toHaveBeenCalledWith(USER_ID, "c1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const markdown = await response.text();
    expect(markdown).toMatch(/^# React hooks\n\nHooks I reuse\.\n/);
  });

  it("answers 404 in JSON for another user's collection", async () => {
    contextData.mockResolvedValue(null);
    const response = await getContext("theirs");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Collection not found." } });
  });
});

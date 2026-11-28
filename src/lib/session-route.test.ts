import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { importBodyError, rateLimitedResponse, requireSessionUser } from "@/lib/session-route";
import { getErrors } from "@/i18n/errors-server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const session = auth as unknown as Mock;

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
});

describe("requireSessionUser", () => {
  it("returns the signed-in user's id", async () => {
    expect(await requireSessionUser()).toEqual({ userId: "user_1" });
  });

  it.each([null, { user: {} }])("answers a translated 401 for session %j", async (value) => {
    session.mockResolvedValue(value);
    setTestLocale("fr");

    const response = await requireSessionUser();

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(await (response as Response).json()).toEqual({ error: (await getErrors()).message("notSignedIn") });
  });
});

describe("rateLimitedResponse", () => {
  it("answers 429 with `{ error }` and Retry-After", async () => {
    const response = await rateLimitedResponse(Date.now() + 90_000);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    expect(Object.keys(await response.json())).toEqual(["error"]);
  });
});

describe("importBodyError", () => {
  it("maps 413 to too large and anything else to a bad request", async () => {
    const e = await getErrors();

    expect(await importBodyError(e, 413).json()).toEqual({ error: e.message("import.tooLarge") });
    expect(importBodyError(e, 400).status).toBe(400);
    expect(await importBodyError(e, 400).json()).toEqual({ error: e.message("import.badRequest") });
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/items/[id]/used/route";
import { auth } from "@/auth";
import { markItemUsed } from "@/lib/db/items";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ markItemUsed: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;

function usedRequest(id: string) {
  return POST(new Request(`http://localhost/api/items/${id}/used`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(markItemUsed).mockResolvedValue(true);
});

describe("POST /api/items/[id]/used", () => {
  it("answers 401 without a session, writing nothing", async () => {
    asMock(auth).mockResolvedValue(null);

    const response = await usedRequest("item_1");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "You are not signed in." });
    expect(markItemUsed).not.toHaveBeenCalled();
  });

  it("records the use for the session's user and answers 204 with no body", async () => {
    const response = await usedRequest("item_1");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(markItemUsed).toHaveBeenCalledWith("user_1", "item_1");
  });

  it("answers 204 too when the throttle skipped the write or the item is not the user's", async () => {
    asMock(markItemUsed).mockResolvedValue(false);

    expect((await usedRequest("item_2")).status).toBe(204);
  });
});

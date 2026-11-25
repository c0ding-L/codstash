import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import { loadAiAllowed } from "@/lib/load-ai-allowed";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const planStatus = asMock(getPlanStatus);

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadAiAllowed", () => {
  it("allows AI for Pro and not for Free", async () => {
    planStatus.mockResolvedValue({ proUntil: new Date(), isPro: true, items: 0, collections: 0 });
    expect(await loadAiAllowed()).toBe(true);
    expect(planStatus).toHaveBeenCalledWith("user_1");

    planStatus.mockResolvedValue({ proUntil: null, isPro: false, items: 0, collections: 0 });
    expect(await loadAiAllowed()).toBe(false);
  });

  it("is false when signed out, without reading", async () => {
    session.mockResolvedValue(null);

    expect(await loadAiAllowed()).toBe(false);
    expect(planStatus).not.toHaveBeenCalled();
  });

  it("is false when the read fails", async () => {
    planStatus.mockRejectedValue(new Error("down"));

    expect(await loadAiAllowed()).toBe(false);
  });
});

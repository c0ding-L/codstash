import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { plan, pro } from "@/lib/__fixtures__/plan";
import { getPlanStatus } from "@/lib/db/billing";
import { loadAiAllowed } from "@/lib/load-ai-allowed";
import { loadShowUpgrade } from "@/lib/load-show-upgrade";
import { loadUploadsAllowed } from "@/lib/load-uploads-allowed";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));

// `auth` is overloaded, so `vi.mocked` cannot narrow it.
const session = auth as unknown as Mock;
const planStatus = vi.mocked(getPlanStatus);

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// The layout's plan-based flags: each reads the plan and is false on the safe side.
describe.each([
  { name: "loadAiAllowed", load: loadAiAllowed, whenPro: true, whenFree: false },
  { name: "loadUploadsAllowed", load: loadUploadsAllowed, whenPro: true, whenFree: false },
  { name: "loadShowUpgrade", load: loadShowUpgrade, whenPro: false, whenFree: true },
])("$name", ({ load, whenPro, whenFree }) => {
  it("follows the user's plan", async () => {
    planStatus.mockResolvedValue(pro());
    expect(await load()).toBe(whenPro);
    expect(planStatus).toHaveBeenCalledWith("user_1");

    planStatus.mockResolvedValue(plan());
    expect(await load()).toBe(whenFree);
  });

  it("is false when signed out, without reading", async () => {
    session.mockResolvedValue(null);

    expect(await load()).toBe(false);
    expect(planStatus).not.toHaveBeenCalled();
  });

  it("is false when the read fails", async () => {
    planStatus.mockRejectedValue(new Error("down"));

    expect(await load()).toBe(false);
  });
});

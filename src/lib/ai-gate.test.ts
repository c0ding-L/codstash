import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getErrors } from "@/i18n/errors-server";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { aiGate, answerLocale } from "@/lib/ai-gate";
import { getPlanStatus } from "@/lib/db/billing";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  tooManyAttemptsMessage: vi.fn(() => "Too many attempts. Please try again in 30 minutes."),
}));

const asMock = (fn: unknown) => fn as Mock;
const planStatus = asMock(getPlanStatus);
const rateLimit = asMock(checkRateLimit);

const allowed = { success: true, remaining: 1, reset: 0 };
const blocked = { success: false, remaining: 0, reset: Date.now() + 60_000 };

beforeEach(() => {
  planStatus.mockResolvedValue({ isPro: true });
  rateLimit.mockResolvedValue(allowed);
});

describe("aiGate", () => {
  it("lets a Pro user through after the three limits, per user then app-wide", async () => {
    expect(await aiGate("user_1", await getErrors())).toBeNull();
    expect(planStatus).toHaveBeenCalledWith("user_1");
    expect(rateLimit.mock.calls).toEqual([
      ["ai", "user_1"],
      ["aiDaily", "user_1"],
      ["aiGlobal", "global"],
    ]);
  });

  it("refuses a Free user with 403 before spending a limiter slot", async () => {
    planStatus.mockResolvedValue({ isPro: false });

    expect(await aiGate("user_1", await getErrors())).toEqual({ status: 403, error: "AI features are a Pro feature." });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ["hourly", [blocked], "Too many attempts. Please try again in 30 minutes."],
    ["daily", [allowed, blocked], "You've used today's AI requests. Try again tomorrow."],
    ["app-wide", [allowed, allowed, blocked], "AI is busy, try again in a minute."],
  ])("stops at the %s limit with 429", async (_, results, error) => {
    for (const result of results) rateLimit.mockResolvedValueOnce(result);

    expect(await aiGate("user_1", await getErrors())).toEqual({ status: 429, error });
    expect(rateLimit).toHaveBeenCalledTimes(results.length);
  });

  it("words the refusal in French", async () => {
    setTestLocale("fr");
    planStatus.mockResolvedValue({ isPro: false });

    const refusal = await aiGate("user_1", await getErrors());
    expect(refusal?.status).toBe(403);
    expect(refusal?.error).not.toBe("AI features are a Pro feature.");
  });
});

describe("answerLocale", () => {
  it("is the UI language", async () => {
    expect(await answerLocale()).toBe("en");
    setTestLocale("fr");
    expect(await answerLocale()).toBe("fr");
  });
});

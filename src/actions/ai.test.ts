import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { plan, pro } from "@/lib/__fixtures__/plan";
import { generateAutoTags, generateDescription } from "@/actions/ai";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { AiProviderError, complete } from "@/lib/ai-client";
import { getPlanStatus } from "@/lib/db/billing";
import { checkRateLimit } from "@/lib/rate-limit";

const PRO_ONLY = "AI features are a Pro feature.";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  tooManyAttemptsMessage: vi.fn(() => "Too many attempts. Please try again in 30 minutes."),
}));
// The real `AiProviderError` and `aiErrorMessage`; only the call is mocked.
vi.mock("@/lib/ai-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-client")>()),
  complete: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const planStatus = asMock(getPlanStatus);
const rateLimit = asMock(checkRateLimit);
const ai = asMock(complete);

const USER_ID = "user_1";
const INPUT = { title: "Debounce hook", content: "export function useDebounce() {}", tags: ["React"] };

const allowed = { success: true, remaining: 1, reset: 0 };
const blocked = { success: false, remaining: 0, reset: Date.now() + 60_000 };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue(pro());
  rateLimit.mockResolvedValue(allowed);
  ai.mockResolvedValue("react, hooks, debounce, typescript");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateAutoTags", () => {
  it("returns new lowercase tags, without the ones the item has", async () => {
    expect(await generateAutoTags(INPUT)).toEqual({
      success: true,
      data: ["hooks", "debounce", "typescript"],
      error: null,
    });
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 300 });
  });

  it("checks the three limits in order, per user then app-wide", async () => {
    await generateAutoTags(INPUT);

    expect(rateLimit.mock.calls).toEqual([
      ["ai", USER_ID],
      ["aiDaily", USER_ID],
      ["aiGlobal", "global"],
    ]);
  });

  it("sends at most 2000 characters of content", async () => {
    await generateAutoTags({ ...INPUT, content: "a".repeat(5_000) });

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toContain(`<content>\n${"a".repeat(2_000)}\n</content>`);
    expect(user.content).not.toContain("a".repeat(2_001));
  });

  it("rejects invalid input before anything else", async () => {
    expect(await generateAutoTags({ ...INPUT, title: "  " })).toMatchObject({ success: false, error: "Add a title first." });
    expect(await generateAutoTags({ ...INPUT, content: "a".repeat(100_001) })).toMatchObject({ success: false });
    expect(await generateAutoTags({ ...INPUT, tags: ["a".repeat(51)] })).toMatchObject({ success: false });
    expect(
      await generateAutoTags({ ...INPUT, tags: Array.from({ length: 21 }, (_, index) => `t${index}`) }),
    ).toMatchObject({ success: false });
    expect(session).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);

    expect(await generateAutoTags(INPUT)).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(planStatus).not.toHaveBeenCalled();
  });

  it("refuses Free users before the rate limits", async () => {
    planStatus.mockResolvedValue(plan());

    expect(await generateAutoTags(INPUT)).toEqual({ success: false, data: null, error: PRO_ONLY });
    expect(planStatus).toHaveBeenCalledWith(USER_ID);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("stops at the hourly limit", async () => {
    rateLimit.mockResolvedValueOnce(blocked);

    expect(await generateAutoTags(INPUT)).toMatchObject({
      success: false,
      error: "Too many attempts. Please try again in 30 minutes.",
    });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(ai).not.toHaveBeenCalled();
  });

  it("stops at the daily limit", async () => {
    rateLimit.mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked);

    expect(await generateAutoTags(INPUT)).toMatchObject({
      success: false,
      error: "You've used today's AI requests. Try again tomorrow.",
    });
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(ai).not.toHaveBeenCalled();
  });

  it("stops at the app-wide limit", async () => {
    rateLimit.mockResolvedValueOnce(allowed).mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked);

    expect(await generateAutoTags(INPUT)).toMatchObject({ success: false, error: "AI is busy, try again in a minute." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("turns a provider error into a friendly message", async () => {
    ai.mockRejectedValue(
      new AiProviderError({ provider: "openrouter", status: 429, code: null, retryAfter: 20, message: "x" }),
    );

    expect(await generateAutoTags(INPUT)).toEqual({
      success: false,
      data: null,
      error: "AI is busy. Try again in 20 seconds.",
    });
  });

  it("reads a configuration error as unavailable", async () => {
    ai.mockRejectedValue(new Error("OPENROUTER_API_KEY is not set"));

    expect(await generateAutoTags(INPUT)).toMatchObject({ success: false, error: "AI is unavailable right now." });
    expect(console.error).toHaveBeenCalled();
  });

  it("says so when no tag is left", async () => {
    ai.mockResolvedValue("react");

    expect(await generateAutoTags(INPUT)).toEqual({
      success: false,
      data: null,
      error: "No tag suggestions for this item.",
    });
  });

  it("fails gracefully when the plan cannot be read", async () => {
    planStatus.mockRejectedValue(new Error("db down"));

    expect(await generateAutoTags(INPUT)).toMatchObject({ success: false, error: "Could not suggest tags. Try again." });
  });
});

describe("generateDescription", () => {
  const LINK = { type: "link", title: "Next.js docs", url: "https://nextjs.org/docs", tags: [] };

  beforeEach(() => {
    ai.mockResolvedValue("Description: The official Next.js documentation, covering routing and data fetching.");
  });

  it("returns the cleaned-up description", async () => {
    expect(await generateDescription(LINK)).toEqual({
      success: true,
      data: "The official Next.js documentation, covering routing and data fetching.",
      error: null,
    });
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 500 });
  });

  it("sends the fields the item has", async () => {
    await generateDescription({ ...INPUT, type: "snippet", language: "typescript" });

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toBe(
      "Type: snippet\nTitle: Debounce hook\nLanguage: typescript\nTags: React\n<content>\nexport function useDebounce() {}\n</content>",
    );
  });

  it("sends a file's name when there is no content", async () => {
    await generateDescription({ type: "file", title: "Q3 report", fileName: "q3-report.pdf", tags: [] });

    expect(ai.mock.calls[0]![0][1].content).toBe("Type: file\nTitle: Q3 report\nFile name: q3-report.pdf");
  });

  it("rejects invalid input before anything else", async () => {
    expect(await generateDescription({ ...LINK, title: "" })).toMatchObject({ success: false, error: "Add a title first." });
    expect(await generateDescription({ ...LINK, url: "a".repeat(2_049) })).toMatchObject({ success: false });
    expect(await generateDescription({ ...LINK, fileName: "a".repeat(256) })).toMatchObject({ success: false });
    expect(await generateDescription({ ...LINK, language: "a".repeat(51) })).toMatchObject({ success: false });
    expect(session).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);

    expect(await generateDescription(LINK)).toMatchObject({ success: false, error: "You are not signed in." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses Free users before the rate limits", async () => {
    planStatus.mockResolvedValue(plan());

    expect(await generateDescription(LINK)).toMatchObject({ success: false, error: PRO_ONLY });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("shares the AI rate limits", async () => {
    rateLimit.mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked);

    expect(await generateDescription(LINK)).toMatchObject({
      success: false,
      error: "You've used today's AI requests. Try again tomorrow.",
    });
    expect(rateLimit.mock.calls).toEqual([
      ["ai", USER_ID],
      ["aiDaily", USER_ID],
    ]);
    expect(ai).not.toHaveBeenCalled();
  });

  it("turns a provider error into a friendly message", async () => {
    ai.mockRejectedValue(
      new AiProviderError({ provider: "openrouter", status: 429, code: null, retryAfter: 20, message: "x" }),
    );

    expect(await generateDescription(LINK)).toMatchObject({ success: false, error: "AI is busy. Try again in 20 seconds." });
  });

  it("says so when the answer is empty", async () => {
    ai.mockResolvedValue("```\n```");

    expect(await generateDescription(LINK)).toMatchObject({
      success: false,
      error: "Could not write a description for this item.",
    });
  });

  it("fails gracefully when the plan cannot be read", async () => {
    planStatus.mockRejectedValue(new Error("db down"));

    expect(await generateDescription(LINK)).toMatchObject({
      success: false,
      error: "Could not write a description. Try again.",
    });
  });
});

describe("answers in the UI language", () => {
  /** The system prompt `complete` was called with. */
  const systemPrompt = () => (ai.mock.calls[0]![0] as { role: string; content: string }[])[0]!.content;

  it("asks Description for French when the UI is in French", async () => {
    setTestLocale("fr");
    ai.mockResolvedValue("Un hook React qui temporise une valeur.");

    await generateDescription(INPUT);

    expect(systemPrompt()).toContain("Write the answer in French.");
  });

  it("asks nothing more in English", async () => {
    ai.mockResolvedValue("A React hook that debounces a value.");

    await generateDescription(INPUT);

    expect(systemPrompt()).not.toContain("French");
  });

  it("leaves Tags in the language of the content", async () => {
    setTestLocale("fr");

    await generateAutoTags(INPUT);

    expect(systemPrompt()).not.toContain("French");
  });
});

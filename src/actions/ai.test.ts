import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { explainCode, generateAutoTags, generateDescription, optimizePrompt } from "@/actions/ai";
import { auth } from "@/auth";
import { AiProviderError, complete } from "@/lib/ai-client";
import { getPlanStatus } from "@/lib/db/billing";
import { getItemForExplain } from "@/lib/db/items";
import { checkRateLimit } from "@/lib/rate-limit";

const PRO_ONLY = "AI features are a Pro feature.";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemForExplain: vi.fn() }));
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
const itemForExplain = asMock(getItemForExplain);

const USER_ID = "user_1";
const INPUT = { title: "Debounce hook", content: "export function useDebounce() {}", tags: ["React"] };

const allowed = { success: true, remaining: 1, reset: 0 };
const blocked = { success: false, remaining: 0, reset: Date.now() + 60_000 };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue({ proUntil: new Date(), isPro: true, items: 0, collections: 0 });
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
    planStatus.mockResolvedValue({ proUntil: null, isPro: false, items: 0, collections: 0 });

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
    planStatus.mockResolvedValue({ proUntil: null, isPro: false, items: 0, collections: 0 });

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

describe("explainCode", () => {
  const SNIPPET = { content: "export const sum = (a, b) => a + b;", language: "typescript", slug: "snippet" };
  const EXPLANATION = "Adds two numbers.\n\n- `sum`: an arrow function";

  beforeEach(() => {
    itemForExplain.mockResolvedValue(SNIPPET);
    ai.mockResolvedValue(EXPLANATION);
  });

  it("explains the user's snippet", async () => {
    expect(await explainCode({ itemId: "item_1" })).toEqual({ success: true, data: EXPLANATION, error: null });
    expect(itemForExplain).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 1_500, timeoutMs: 60_000 });
  });

  it("explains a command", async () => {
    itemForExplain.mockResolvedValue({ content: "ls -la", language: null, slug: "command" });

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: true });
  });

  it("sends the language and the content", async () => {
    await explainCode({ itemId: "item_1" });

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toBe(`Language: typescript\n<content>\n${SNIPPET.content}\n</content>`);
  });

  it("sends at most 12,000 characters, marked as truncated", async () => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, content: "a".repeat(20_000) });

    await explainCode({ itemId: "item_1" });

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toContain(`<content>\n${"a".repeat(12_000)}\n[truncated]\n</content>`);
    expect(user.content).not.toContain("a".repeat(12_001));
  });

  it("rejects invalid input before anything else", async () => {
    expect(await explainCode({ itemId: "  " })).toMatchObject({ success: false, error: "Item not found." });
    expect(await explainCode({ itemId: "a".repeat(101) })).toMatchObject({ success: false });
    expect(await explainCode({} as { itemId: string })).toMatchObject({ success: false });
    expect(session).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);

    expect(await explainCode({ itemId: "item_1" })).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(planStatus).not.toHaveBeenCalled();
  });

  it("refuses Free users before the rate limits and the item", async () => {
    planStatus.mockResolvedValue({ proUntil: null, isPro: false, items: 0, collections: 0 });

    expect(await explainCode({ itemId: "item_1" })).toEqual({ success: false, data: null, error: PRO_ONLY });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(itemForExplain).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("checks the three limits in order before reading the item", async () => {
    await explainCode({ itemId: "item_1" });

    expect(rateLimit.mock.calls).toEqual([
      ["ai", USER_ID],
      ["aiDaily", USER_ID],
      ["aiGlobal", "global"],
    ]);
  });

  it.each([
    ["hourly", [blocked], "Too many attempts. Please try again in 30 minutes."],
    ["daily", [allowed, blocked], "You've used today's AI requests. Try again tomorrow."],
    ["app-wide", [allowed, allowed, blocked], "AI is busy, try again in a minute."],
  ])("stops at the %s limit", async (_, results, error) => {
    for (const result of results) rateLimit.mockResolvedValueOnce(result);

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: false, error });
    expect(itemForExplain).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("says not found for a missing item or another user's", async () => {
    itemForExplain.mockResolvedValue(null);

    expect(await explainCode({ itemId: "someone_elses" })).toEqual({ success: false, data: null, error: "Item not found." });
    expect(ai).not.toHaveBeenCalled();
  });

  it.each(["note", "prompt", "link", "file", "image", "custom"])("refuses a %s", async (slug) => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, slug });

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({
      success: false,
      error: "Only snippets and commands can be explained.",
    });
    expect(ai).not.toHaveBeenCalled();
  });

  it.each([null, "", "  \n "])("refuses empty content: %j", async (content) => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, content });

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: false, error: "There is no code to explain." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("strips a fence wrapping the whole answer", async () => {
    ai.mockResolvedValue(`\`\`\`markdown\n${EXPLANATION}\n\`\`\``);

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: true, data: EXPLANATION });
  });

  it("says so when the answer is empty", async () => {
    ai.mockResolvedValue("```markdown\n```");

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: false, error: "Could not explain this code." });
  });

  it("turns a provider error into a friendly message", async () => {
    ai.mockRejectedValue(
      new AiProviderError({ provider: "openrouter", status: 429, code: null, retryAfter: 20, message: "x" }),
    );

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({ success: false, error: "AI is busy. Try again in 20 seconds." });
  });

  it("fails gracefully when the item cannot be read", async () => {
    itemForExplain.mockRejectedValue(new Error("db down"));

    expect(await explainCode({ itemId: "item_1" })).toMatchObject({
      success: false,
      error: "Could not explain this code. Try again.",
    });
  });
});

describe("optimizePrompt", () => {
  const PROMPT = { content: "review my code", language: null, slug: "prompt" };
  const BETTER = "Review the code below for bugs and readability.\n\n{{code}}";

  beforeEach(() => {
    itemForExplain.mockResolvedValue(PROMPT);
    ai.mockResolvedValue(BETTER);
  });

  it("returns the rewrite of the user's prompt, refusing a cut-off answer", async () => {
    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({ success: true, data: BETTER, error: null });
    expect(itemForExplain).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 3_000, timeoutMs: 90_000, rejectCutOff: true });
  });

  it("sends the whole prompt inside the delimiters", async () => {
    await optimizePrompt({ itemId: "item_1" });

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toBe(`<content>\n${PROMPT.content}\n</content>`);
  });

  it("returns null when there is nothing to improve", async () => {
    ai.mockResolvedValue("NO_CHANGES");
    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({ success: true, data: null, error: null });

    ai.mockResolvedValue("  review   my code\n");
    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({ success: true, data: null, error: null });
  });

  it("refuses a prompt over 8,000 characters without calling the AI", async () => {
    itemForExplain.mockResolvedValue({ ...PROMPT, content: "a".repeat(8_001) });

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({
      success: false,
      data: null,
      error: "This prompt is too long to optimize (at most 8,000 characters).",
    });
    expect(ai).not.toHaveBeenCalled();
  });

  it("accepts a prompt of exactly 8,000 characters", async () => {
    itemForExplain.mockResolvedValue({ ...PROMPT, content: "a".repeat(8_000) });

    expect(await optimizePrompt({ itemId: "item_1" })).toMatchObject({ success: true });
  });

  it("rejects invalid input before anything else", async () => {
    expect(await optimizePrompt({ itemId: "  " })).toMatchObject({ success: false, error: "Item not found." });
    expect(await optimizePrompt({} as { itemId: string })).toMatchObject({ success: false });
    expect(session).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    session.mockResolvedValue(null);

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({ success: false, data: null, error: "You are not signed in." });
    expect(planStatus).not.toHaveBeenCalled();
  });

  it("refuses Free users before the rate limits and the item", async () => {
    planStatus.mockResolvedValue({ proUntil: null, isPro: false, items: 0, collections: 0 });

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({ success: false, data: null, error: PRO_ONLY });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(itemForExplain).not.toHaveBeenCalled();
  });

  it("stops at a rate limit before reading the item", async () => {
    rateLimit.mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked);

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({
      success: false,
      data: null,
      error: "You've used today's AI requests. Try again tomorrow.",
    });
    expect(itemForExplain).not.toHaveBeenCalled();
  });

  it("refuses another user's or a missing item, other types and an empty prompt", async () => {
    itemForExplain.mockResolvedValue(null);
    expect(await optimizePrompt({ itemId: "item_1" })).toMatchObject({ success: false, error: "Item not found." });

    itemForExplain.mockResolvedValue({ ...PROMPT, slug: "snippet" });
    expect(await optimizePrompt({ itemId: "item_1" })).toMatchObject({
      success: false,
      error: "Only prompts can be optimized.",
    });

    itemForExplain.mockResolvedValue({ ...PROMPT, content: "  \n " });
    expect(await optimizePrompt({ itemId: "item_1" })).toMatchObject({
      success: false,
      error: "There is no prompt to optimize.",
    });
    expect(ai).not.toHaveBeenCalled();
  });

  it("maps an AI failure, including a cut-off answer, to its message", async () => {
    ai.mockRejectedValue(new AiProviderError({ provider: "openrouter", status: null, code: "cut_off", message: "x" }));
    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({
      success: false,
      data: null,
      error: "The AI's answer was cut short. Try again.",
    });

    ai.mockRejectedValue(new AiProviderError({ provider: "openrouter", status: 408, code: "timeout", message: "x" }));
    expect(await optimizePrompt({ itemId: "item_1" })).toMatchObject({ error: "AI took too long. Try again." });
  });

  it("fails when the answer holds nothing usable", async () => {
    ai.mockResolvedValue("```\n\n```");

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({
      success: false,
      data: null,
      error: "Could not optimize this prompt.",
    });
  });

  it("reports an unexpected failure without details", async () => {
    itemForExplain.mockRejectedValue(new Error("db down"));

    expect(await optimizePrompt({ itemId: "item_1" })).toEqual({
      success: false,
      data: null,
      error: "Could not optimize this prompt. Try again.",
    });
  });
});

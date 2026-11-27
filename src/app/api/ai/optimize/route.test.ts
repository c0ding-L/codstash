import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/ai/optimize/route";
import { auth } from "@/auth";
import { AiProviderError, completeStream, type AiStream } from "@/lib/ai-client";
import { CUT_OFF_MARKER, errorMarker } from "@/lib/ai-stream-protocol";
import { getPlanStatus } from "@/lib/db/billing";
import { getItemForExplain } from "@/lib/db/items";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemForExplain: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  tooManyAttemptsMessage: vi.fn(() => "Too many attempts. Please try again in 30 minutes."),
}));
vi.mock("@/lib/ai-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-client")>()),
  completeStream: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const planStatus = asMock(getPlanStatus);
const rateLimit = asMock(checkRateLimit);
const ai = asMock(completeStream);
const itemForExplain = asMock(getItemForExplain);

const PROMPT = { content: "review my code", language: null, slug: "prompt" };
const allowed = { success: true, remaining: 1, reset: 0 };
const blocked = { success: false, remaining: 0, reset: Date.now() + 60_000 };

function answer(chunks: string[], { finishReason = "stop", failWith }: { finishReason?: string; failWith?: unknown } = {}): AiStream {
  const queue = [...chunks];
  const stream = new ReadableStream<string>({
    // Pulled one chunk at a time, so a failure comes after the text, as from `completeStream`.
    pull(controller) {
      const next = queue.shift();
      if (next !== undefined) controller.enqueue(next);
      else if (failWith) controller.error(failWith);
      else controller.close();
    },
  });
  return { stream, finishReason: () => finishReason };
}

const optimize = (body: unknown = { itemId: "item_1" }) =>
  POST(new Request("http://localhost/api/ai/optimize", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
  planStatus.mockResolvedValue({ isPro: true });
  rateLimit.mockResolvedValue(allowed);
  itemForExplain.mockResolvedValue(PROMPT);
  ai.mockResolvedValue(answer(["Review the code ", "for bugs."]));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/ai/optimize", () => {
  it("streams the rewrite of the whole prompt", async () => {
    const response = await optimize();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("Review the code for bugs.");
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 3_000, signal: expect.any(AbortSignal) });
    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toBe(`<content>\n${PROMPT.content}\n</content>`);
  });

  it("answers 400 to invalid input and 401 when signed out", async () => {
    expect((await optimize({ itemId: "" })).status).toBe(400);
    expect(session).not.toHaveBeenCalled();

    session.mockResolvedValue(null);
    expect((await optimize()).status).toBe(401);
  });

  it("answers 404 for another user's item, spending no limiter slot", async () => {
    itemForExplain.mockResolvedValue(null);

    const response = await optimize();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item not found." });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("refuses other types, an empty prompt and one over 8,000 characters before the gate", async () => {
    itemForExplain.mockResolvedValue({ ...PROMPT, slug: "snippet" });
    expect(await (await optimize()).json()).toEqual({ error: "Only prompts can be optimized." });

    itemForExplain.mockResolvedValue({ ...PROMPT, content: "  \n " });
    expect(await (await optimize()).json()).toEqual({ error: "There is no prompt to optimize." });

    itemForExplain.mockResolvedValue({ ...PROMPT, content: "a".repeat(8_001) });
    const tooLong = await optimize();
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({ error: "This prompt is too long to optimize (at most 8,000 characters)." });

    expect(planStatus).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("accepts a prompt of exactly 8,000 characters", async () => {
    itemForExplain.mockResolvedValue({ ...PROMPT, content: "a".repeat(8_000) });

    expect((await optimize()).status).toBe(200);
  });

  it("answers 403 to a Free user and 429 at a limit", async () => {
    planStatus.mockResolvedValue({ isPro: false });
    expect((await optimize()).status).toBe(403);

    planStatus.mockResolvedValue({ isPro: true });
    rateLimit.mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked);
    const limited = await optimize();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "You've used today's AI requests. Try again tomorrow." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("answers a provider failure before any text with its message", async () => {
    ai.mockRejectedValue(new AiProviderError({ provider: "openrouter", status: 408, code: "timeout", message: "x" }));

    const response = await optimize();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "AI took too long. Try again." });
  });

  it("ends with the cut-off marker on the token cap, so the half rewrite is never offered", async () => {
    ai.mockResolvedValue(answer(["Review the"], { finishReason: "length" }));

    expect(await (await optimize()).text()).toBe(`Review the${CUT_OFF_MARKER}`);
  });

  it("ends with the error marker when the answer fails midway", async () => {
    ai.mockResolvedValue(answer(["Review"], { failWith: new TypeError("socket hang up") }));

    expect(await (await optimize()).text()).toBe(`Review${errorMarker("AI is unavailable right now.")}`);
  });

  it("never caps the length: the rewrite is checked whole by the browser", async () => {
    ai.mockResolvedValue(answer(["a".repeat(5_000), "b".repeat(5_000)]));

    expect(await (await optimize()).text()).toBe(`${"a".repeat(5_000)}${"b".repeat(5_000)}`);
  });

  it("answers 500 without details on an unexpected failure", async () => {
    itemForExplain.mockRejectedValue(new Error("db down"));

    const response = await optimize();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not optimize this prompt. Try again." });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/ai/explain/route";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
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
// The real `AiProviderError` and messages; only the call is mocked.
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

const USER_ID = "user_1";
const SNIPPET = { content: "export const sum = (a, b) => a + b;", language: "typescript", slug: "snippet" };
const allowed = { success: true, remaining: 1, reset: 0 };
const blocked = { success: false, remaining: 0, reset: Date.now() + 60_000 };

/** A streamed answer of these chunks, then an optional failure. */
function answer(chunks: string[], { finishReason = "stop", failWith }: { finishReason?: string; failWith?: unknown } = {}) {
  const cancel = vi.fn();
  const queue = [...chunks];
  const stream = new ReadableStream<string>({
    // Pulled one chunk at a time, so a failure comes after the text, as from `completeStream`.
    pull(controller) {
      const next = queue.shift();
      if (next !== undefined) controller.enqueue(next);
      else if (failWith) controller.error(failWith);
      else controller.close();
    },
    cancel,
  });
  const result: AiStream = { stream, finishReason: () => finishReason };
  return Object.assign(result, { cancel });
}

const explain = (body: unknown = { itemId: "item_1" }) =>
  POST(new Request("http://localhost/api/ai/explain", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue({ isPro: true });
  rateLimit.mockResolvedValue(allowed);
  itemForExplain.mockResolvedValue(SNIPPET);
  ai.mockResolvedValue(answer(["Adds ", "two numbers."]));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.useRealTimers());

describe("POST /api/ai/explain", () => {
  it("streams the explanation as plain text, never cached", async () => {
    const response = await explain();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("Adds two numbers.");
    expect(itemForExplain).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 1_500, signal: expect.any(AbortSignal) });
  });

  it("sends the language and the content, at most 12,000 characters", async () => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, content: "a".repeat(20_000) });
    await explain();

    const [, user] = ai.mock.calls[0]![0];
    expect(user.content).toContain(`Language: typescript\n<content>\n${"a".repeat(12_000)}\n[truncated]\n</content>`);
  });

  it("rejects invalid input before anything else", async () => {
    for (const body of [{ itemId: "  " }, { itemId: "a".repeat(101) }, {}]) {
      const response = await explain(body);
      expect(response.status).toBe(400);
    }
    const notJson = await POST(new Request("http://localhost/api/ai/explain", { method: "POST", body: "{" }));
    expect(notJson.status).toBe(400);
    expect(session).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    session.mockResolvedValue(null);

    const response = await explain();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "You are not signed in." });
    expect(itemForExplain).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing item or another user's, spending no limiter slot", async () => {
    itemForExplain.mockResolvedValue(null);

    const response = await explain({ itemId: "someone_elses" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item not found." });
    expect(planStatus).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each(["note", "prompt", "link", "file", "image", "custom"])("refuses a %s before the gate", async (slug) => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, slug });

    const response = await explain();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Only snippets and commands can be explained." });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(ai).not.toHaveBeenCalled();
  });

  it("refuses empty code", async () => {
    itemForExplain.mockResolvedValue({ ...SNIPPET, content: " \n " });

    expect(await (await explain()).json()).toEqual({ error: "There is no code to explain." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("answers 403 to a Free user", async () => {
    planStatus.mockResolvedValue({ isPro: false });

    const response = await explain();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "AI features are a Pro feature." });
    expect(ai).not.toHaveBeenCalled();
  });

  it.each([
    ["hourly", [blocked], "Too many attempts. Please try again in 30 minutes."],
    ["daily", [allowed, blocked], "You've used today's AI requests. Try again tomorrow."],
    ["app-wide", [allowed, allowed, blocked], "AI is busy, try again in a minute."],
  ])("answers 429 at the %s limit", async (_, results, error) => {
    for (const result of results) rateLimit.mockResolvedValueOnce(result);

    const response = await explain();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error });
    expect(ai).not.toHaveBeenCalled();
  });

  it("answers a provider failure before any text with its message", async () => {
    ai.mockRejectedValue(new AiProviderError({ provider: "openrouter", status: 429, code: null, retryAfter: 20, message: "x" }));

    const response = await explain();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "AI is busy. Try again in 20 seconds." });
  });

  it("ends with the error marker when the answer fails midway", async () => {
    ai.mockResolvedValue(
      answer(["Adds "], { failWith: new AiProviderError({ provider: "openrouter", status: 408, code: "timeout", message: "x" }) }),
    );

    expect(await (await explain()).text()).toBe(`Adds ${errorMarker("AI took too long. Try again.")}`);
  });

  it("ends with the cut-off marker on the token cap", async () => {
    ai.mockResolvedValue(answer(["Adds two"], { finishReason: "length" }));

    expect(await (await explain()).text()).toBe(`Adds two${CUT_OFF_MARKER}`);
  });

  it("stops at 4,000 characters, with the cut-off marker, and stops the AI", async () => {
    const stream = answer(["a".repeat(3_000), "b".repeat(3_000), "c".repeat(3_000)]);
    ai.mockResolvedValue(stream);

    const body = await (await explain()).text();
    expect(body).toBe(`${"a".repeat(3_000)}${"b".repeat(1_000)}${CUT_OFF_MARKER}`);
    expect(stream.cancel).toHaveBeenCalled();
  });

  it("stops at its own deadline, ahead of maxDuration, with the cut-off marker", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    ai.mockResolvedValue({
      // One chunk, then nothing: the model stalls past the deadline without the idle timeout firing.
      stream: new ReadableStream<string>({ start: (controller) => controller.enqueue("Adds "), cancel }),
      finishReason: () => null,
    });

    const response = await explain();
    const text = response.text();
    await vi.advanceTimersByTimeAsync(110_000);

    expect(await text).toBe(`Adds ${CUT_OFF_MARKER}`);
    expect(cancel).toHaveBeenCalled();
  });

  it("answers 500 without details when the item cannot be read", async () => {
    itemForExplain.mockRejectedValue(new Error("db down"));

    const response = await explain();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not explain this code. Try again." });
  });

  it("asks for French when the UI is in French, and words its errors in French", async () => {
    setTestLocale("fr");
    planStatus.mockResolvedValue({ isPro: false });
    const refused = await (await explain()).json();
    expect(refused.error).not.toBe("AI features are a Pro feature.");

    planStatus.mockResolvedValue({ isPro: true });
    await explain();
    const [system] = ai.mock.calls[0]![0];
    expect(system.content).toContain("Write the answer in French.");
  });
});

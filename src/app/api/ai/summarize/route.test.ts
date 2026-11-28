import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/ai/summarize/route";
import { auth } from "@/auth";
import { allowedLimit, fakeAiStream } from "@/lib/__fixtures__/ai-stream";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { AiProviderError, completeStream } from "@/lib/ai-client";
import { CUT_OFF_MARKER, SECRET_WARNING_HEADER } from "@/lib/ai-stream-protocol";
import { getPlanStatus } from "@/lib/db/billing";
import { getItemForSummary } from "@/lib/db/items";
import { getObject } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemForSummary: vi.fn() }));
vi.mock("@/lib/r2", () => ({ getObject: vi.fn() }));
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
const itemForSummary = asMock(getItemForSummary);
const r2Object = asMock(getObject);

const USER_ID = "user_1";
const LONG = "Restart the API, then check the logs. ".repeat(50);
const NOTE = { title: "Runbook", slug: "note", content: LONG, fileUrl: null, fileName: null, fileSize: null };
const FILE = { title: "CI", slug: "file", content: null, fileUrl: "u/user_1/ci.yml", fileName: "ci.yml", fileSize: 20_000 };

/** An R2 object whose body is these bytes. */
function object(content: string | Uint8Array) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return { body, size: bytes.length };
}

const summarize = (body: unknown = { itemId: "item_1" }) =>
  POST(new Request("http://localhost/api/ai/summarize", { method: "POST", body: JSON.stringify(body) }));

/** The user message sent to the model. */
const sentText = () => (ai.mock.calls[0]![0] as { content: string }[])[1]!.content;

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER_ID } });
  planStatus.mockResolvedValue({ isPro: true });
  rateLimit.mockResolvedValue(allowedLimit());
  itemForSummary.mockResolvedValue(NOTE);
  ai.mockResolvedValue(fakeAiStream(["A runbook ", "for the API."]));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/ai/summarize", () => {
  it("streams a note's summary as plain text, never cached", async () => {
    const response = await summarize();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get(SECRET_WARNING_HEADER)).toBeNull();
    expect(await response.text()).toBe("A runbook for the API.");
    expect(itemForSummary).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(ai).toHaveBeenCalledWith(expect.any(Array), { maxTokens: 1_000, signal: expect.any(AbortSignal) });
    expect(sentText()).toContain(`Type: note\nTitle: Runbook\n<content>\n${LONG.trim()}\n</content>`);
    expect(r2Object).not.toHaveBeenCalled();
  });

  it("cuts a long note at 12,000 characters and marks it", async () => {
    itemForSummary.mockResolvedValue({ ...NOTE, content: "a".repeat(20_000) });
    await summarize();
    expect(sentText()).toContain(`<content>\n${"a".repeat(12_000)}\n[truncated]\n</content>`);
  });

  it("summarizes a prompt as a prompt", async () => {
    itemForSummary.mockResolvedValue({ ...NOTE, slug: "prompt" });
    await summarize();
    expect(sentText()).toMatch(/^Type: prompt\n/);
  });

  it("reads a text file from R2, cut at the limit", async () => {
    itemForSummary.mockResolvedValue(FILE);
    r2Object.mockResolvedValue(object(`on: push\n${"x".repeat(15_000)}`));

    const response = await summarize();
    expect(response.status).toBe(200);
    expect(r2Object).toHaveBeenCalledWith("u/user_1/ci.yml");
    expect(sentText()).toContain("Type: file\nTitle: CI\nFile name: ci.yml\n<content>\non: push\n");
    expect(sentText()).toContain("\n[truncated]\n</content>");
    expect(response.headers.get(SECRET_WARNING_HEADER)).toBeNull();
  });

  it("flags a file whose text holds a secret, and still summarizes it", async () => {
    itemForSummary.mockResolvedValue(FILE);
    r2Object.mockResolvedValue(object(`-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n${"x".repeat(2_000)}`));

    const response = await summarize();
    expect(response.status).toBe(200);
    expect(response.headers.get(SECRET_WARNING_HEADER)).toBe("1");
    expect(ai).toHaveBeenCalled();
  });

  it("answers 404 for a file missing from R2", async () => {
    itemForSummary.mockResolvedValue(FILE);
    r2Object.mockResolvedValue(null);

    const response = await summarize();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "The file could not be found." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("answers 400 for a file that is not UTF-8 text", async () => {
    itemForSummary.mockResolvedValue(FILE);
    r2Object.mockResolvedValue(object(new Uint8Array([0x61, 0xff, 0xfe, 0x62])));

    const response = await summarize();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "This file is not readable text." });
    expect(ai).not.toHaveBeenCalled();
  });

  it("answers 400 to invalid input before anything else", async () => {
    expect((await summarize({ itemId: " " })).status).toBe(400);
    expect(session).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    session.mockResolvedValue(null);
    const response = await summarize();
    expect(response.status).toBe(401);
    expect(itemForSummary).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing item or another user's", async () => {
    itemForSummary.mockResolvedValue(null);
    const response = await summarize();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Item not found." });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ["a short note", { ...NOTE, content: "Too short." }],
    ["a snippet", { ...NOTE, slug: "snippet" }],
    ["a custom type", { ...NOTE, slug: "custom" }],
    ["a PDF", { ...FILE, fileName: "spec.pdf" }],
    ["a short text file", { ...FILE, fileSize: 100 }],
  ])("refuses %s before the gate", async (_, item) => {
    itemForSummary.mockResolvedValue(item);

    const response = await summarize();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Only long notes, prompts and text files can be summarized." });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(planStatus).not.toHaveBeenCalled();
    expect(r2Object).not.toHaveBeenCalled();
  });

  it("answers 403 to a Free user", async () => {
    planStatus.mockResolvedValue({ isPro: false });

    const response = await summarize();
    expect(response.status).toBe(403);
    expect(ai).not.toHaveBeenCalled();
  });

  it("reads no file from R2 for a Free user or over the rate limit", async () => {
    itemForSummary.mockResolvedValue(FILE);
    planStatus.mockResolvedValue({ isPro: false });
    expect((await summarize()).status).toBe(403);

    planStatus.mockResolvedValue({ isPro: true });
    rateLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
    expect((await summarize()).status).toBe(429);

    expect(r2Object).not.toHaveBeenCalled();
  });

  it("answers a provider failure before any text with its message", async () => {
    ai.mockRejectedValue(new AiProviderError({ provider: "openrouter", status: 429, code: null, retryAfter: 20, message: "x" }));

    const response = await summarize();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "AI is busy. Try again in 20 seconds." });
  });

  it("stops at 3,000 characters with the cut-off marker", async () => {
    ai.mockResolvedValue(fakeAiStream(["a".repeat(2_000), "b".repeat(2_000)]));
    expect(await (await summarize()).text()).toBe(`${"a".repeat(2_000)}${"b".repeat(1_000)}${CUT_OFF_MARKER}`);
  });

  it("answers in French for the French UI", async () => {
    setTestLocale("fr");
    itemForSummary.mockResolvedValue({ ...NOTE, content: "court" });

    const response = await summarize();
    expect(await response.json()).toEqual({
      error: "Seules les notes longues, les prompts et les fichiers texte peuvent faire l’objet d’un résumé.",
    });
  });
});

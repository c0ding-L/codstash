import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import {
  AiProviderError,
  aiErrorMessage,
  complete,
  completeStream,
  parseRetryAfter,
  parseSseChunk,
  type AiMessage,
} from "@/lib/ai-client";

const fetchMock = vi.fn();

const MESSAGES: AiMessage[] = [
  { role: "system", content: "sys" },
  { role: "user", content: "hello" },
];

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const answer = (content: string | null, finishReason = "stop") =>
  json(200, { choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }] });

/** The `complete` rejection, for its fields. */
async function failure(): Promise<AiProviderError> {
  const error = await complete(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AiProviderError);
  return error as AiProviderError;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENROUTER_API_KEY", "or_key");
  vi.stubEnv("OPENAI_API_KEY", "oa_key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("complete on OpenRouter (the default)", () => {
  it("posts the request with OpenRouter's fields", async () => {
    fetchMock.mockResolvedValue(answer("  react, hooks  "));

    expect(await complete(MESSAGES, { maxTokens: 300 })).toBe("react, hooks");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer or_key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      messages: MESSAGES,
      max_tokens: 300,
      temperature: 0.2,
      reasoning: { effort: "low", exclude: true },
    });
  });

  it("treats an empty AI_PROVIDER and AI_MODEL as the defaults", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_MODEL", "");
    fetchMock.mockResolvedValue(answer("x"));

    await complete(MESSAGES, { maxTokens: 300 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
  });

  it("uses AI_MODEL when set", async () => {
    vi.stubEnv("AI_MODEL", "other/model:free");
    fetchMock.mockResolvedValue(answer("x"));

    await complete(MESSAGES, { maxTokens: 300 });

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).model).toBe("other/model:free");
  });

  it("throws on a missing key without calling out", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    await expect(complete(MESSAGES, { maxTokens: 300 })).rejects.toThrow("OPENROUTER_API_KEY is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an error status and OpenRouter's error type", async () => {
    fetchMock.mockResolvedValue(
      json(403, { error: { code: 403, message: "flagged", metadata: { error_type: "moderation" } } }),
    );

    const error = await failure();
    expect(error).toMatchObject({ provider: "openrouter", status: 403, code: "moderation", retryAfter: null });
  });

  it("reads an error in a 200 body before the choices", async () => {
    fetchMock.mockResolvedValue(json(200, { error: { code: 502, message: "upstream" }, choices: [] }));

    expect(await failure()).toMatchObject({ status: 502, code: null });
  });

  it("reads Retry-After on a 429", async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 429, message: "slow down" } }, { "Retry-After": "12" }));

    expect(await failure()).toMatchObject({ status: 429, retryAfter: 12 });
  });

  it("logs an excerpt of the body with the provider, never the key", async () => {
    fetchMock.mockResolvedValue(new Response("x".repeat(1_000), { status: 500 }));

    expect(await failure()).toMatchObject({ status: 500 });
    const logged = String(vi.mocked(console.error).mock.calls[0]![0]);
    expect(logged).toContain("openrouter");
    expect(logged.length).toBeLessThan(400);
    expect(logged).not.toContain("or_key");
  });

  it("treats empty content as an error, not as no answer", async () => {
    fetchMock.mockResolvedValue(answer("   "));
    expect(await failure()).toMatchObject({ status: null, code: "empty_response" });

    fetchMock.mockResolvedValue(answer(null, "length"));
    expect(await failure()).toMatchObject({ status: null, code: "length" });
  });

  it("keeps a non-empty answer cut off at the token cap, unless the caller rejects it", async () => {
    fetchMock.mockResolvedValue(answer("Half a prom", "length"));
    expect(await complete(MESSAGES, { maxTokens: 300 })).toBe("Half a prom");

    fetchMock.mockResolvedValue(answer("Half a prom", "length"));
    const error = await complete(MESSAGES, { maxTokens: 300, rejectCutOff: true }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: null, code: "cut_off" });

    fetchMock.mockResolvedValue(answer("A whole prompt."));
    expect(await complete(MESSAGES, { maxTokens: 300, rejectCutOff: true })).toBe("A whole prompt.");
  });

  it("gives up after 15 s by default, or after the caller's timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    // A new response per call: a body can be read only once.
    fetchMock.mockImplementation(async () => answer("ok"));

    await complete(MESSAGES, { maxTokens: 300 });
    await complete(MESSAGES, { maxTokens: 300, timeoutMs: 60_000 });

    expect(timeout.mock.calls).toEqual([[15_000], [60_000]]);
  });

  it("maps a timeout to 408 and a network failure to no status", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await failure()).toMatchObject({ status: 408, code: "timeout" });

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await failure()).toMatchObject({ status: null, code: "network" });
  });
});

describe("complete on OpenAI", () => {
  beforeEach(() => vi.stubEnv("AI_PROVIDER", "openai"));

  it("posts the request with OpenAI's fields and no temperature", async () => {
    fetchMock.mockResolvedValue(answer("react"));

    expect(await complete(MESSAGES, { maxTokens: 300 })).toBe("react");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer oa_key");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-6-luna",
      messages: MESSAGES,
      max_completion_tokens: 300,
      reasoning_effort: "none",
    });
  });

  it("throws on a missing OpenAI key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(complete(MESSAGES, { maxTokens: 300 })).rejects.toThrow("OPENAI_API_KEY is not set");
  });

  it("maps OpenAI's string error code", async () => {
    fetchMock.mockResolvedValue(
      json(429, { error: { message: "quota", type: "insufficient_quota", code: "insufficient_quota" } }),
    );

    expect(await failure()).toMatchObject({ provider: "openai", status: 429, code: "insufficient_quota" });
  });

  it("falls back to the error type when there is no code", async () => {
    fetchMock.mockResolvedValue(json(400, { error: { message: "bad", type: "invalid_request_error", code: null } }));

    expect(await failure()).toMatchObject({ status: 400, code: "invalid_request_error" });
  });
});

describe("complete with an unknown provider", () => {
  it("throws without calling out", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");

    await expect(complete(MESSAGES, { maxTokens: 300 })).rejects.toThrow('Unknown AI_PROVIDER "anthropic"');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    const now = Date.parse("2026-11-25T10:00:00Z");
    expect(parseRetryAfter("30", now)).toBe(30);
    expect(parseRetryAfter("Wed, 25 Nov 2026 10:02:00 GMT", now)).toBe(120);
    expect(parseRetryAfter("Wed, 25 Nov 2026 09:00:00 GMT", now)).toBe(1);
  });

  it("is null when missing or unreadable", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});

describe("aiErrorMessage", async () => {
  const error = (status: number | null, code: string | null = null, retryAfter: number | null = null) =>
    new AiProviderError({ provider: "openrouter", status, code, retryAfter, message: "x" });

  it("maps each status to its message", async () => {
    expect(await aiErrorMessage(error(400))).toBe("AI request failed.");
    expect(await aiErrorMessage(error(401))).toBe("AI is unavailable right now.");
    expect(await aiErrorMessage(error(402))).toBe("AI is unavailable right now.");
    expect(await aiErrorMessage(error(403))).toBe("The AI declined this content.");
    expect(await aiErrorMessage(error(404))).toBe("AI is unavailable right now.");
    expect(await aiErrorMessage(error(408))).toBe("AI took too long. Try again.");
    expect(await aiErrorMessage(error(504))).toBe("AI took too long. Try again.");
    for (const status of [500, 502, 503]) {
      expect(await aiErrorMessage(error(status))).toBe("AI is unavailable right now. Try again.");
    }
  });

  it("says how long to wait on a rate-limit 429", async () => {
    expect(await aiErrorMessage(error(429, null, 1))).toBe("AI is busy. Try again in 1 second.");
    expect(await aiErrorMessage(error(429, null, 20))).toBe("AI is busy. Try again in 20 seconds.");
    expect(await aiErrorMessage(error(429, null, 90))).toBe("AI is busy. Try again in 2 minutes.");
    expect(await aiErrorMessage(error(429))).toBe("AI is busy. Try again in a minute.");
  });

  it("words the wait in French", async () => {
    setTestLocale("fr");

    expect(await aiErrorMessage(error(429, null, 1))).toBe("L’IA est occupée. Réessayez dans 1 seconde.");
    expect(await aiErrorMessage(error(429, null, 20))).toBe("L’IA est occupée. Réessayez dans 20 secondes.");
    expect(await aiErrorMessage(error(429, null, 90))).toBe("L’IA est occupée. Réessayez dans 2 minutes.");
    expect(await aiErrorMessage(error(403))).toBe("L’IA a refusé ce contenu.");
  });

  it("never says try again on a spend-limit or out-of-credits 429", async () => {
    for (const code of ["project_spend_limit_exceeded", "organization_spend_limit_exceeded", "insufficient_quota"]) {
      expect(await aiErrorMessage(error(429, code, 30))).toBe("AI is unavailable right now.");
    }
  });

  it("says a cut-off answer was cut short", async () => {
    expect(await aiErrorMessage(error(null, "cut_off"))).toBe("The AI's answer was cut short. Try again.");
  });

  it("reads an empty answer, a network failure or any other error as unavailable", async () => {
    expect(await aiErrorMessage(error(null, "length"))).toBe("AI is unavailable right now. Try again.");
    expect(await aiErrorMessage(new Error("OPENROUTER_API_KEY is not set"))).toBe("AI is unavailable right now.");
  });
});

describe("parseSseChunk", () => {
  const delta = (content: string, finish: string | null = null) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] })}`;

  it("reads text deltas and keeps an incomplete last line for the next chunk", () => {
    const line = delta("Hello");
    const { events, rest } = parseSseChunk(`${delta("Hi")}\n\n${line.slice(0, 10)}`);
    expect(events).toEqual([{ type: "text", text: "Hi" }]);
    expect(rest).toBe(line.slice(0, 10));

    expect(parseSseChunk(`${rest}${line.slice(10)}\n`).events).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("skips comments, blank lines, other fields and broken JSON", () => {
    const { events } = parseSseChunk(": OPENROUTER PROCESSING\n\nevent: ping\nid: 3\ndata: {oops\r\n");
    expect(events).toEqual([]);
  });

  it("reads the finish reason, [DONE] and CRLF line ends", () => {
    const { events } = parseSseChunk(`${delta("end.", "length")}\r\ndata: [DONE]\r\n`);
    expect(events).toEqual([
      { type: "text", text: "end." },
      { type: "finish", reason: "length" },
      { type: "done" },
    ]);
  });

  it("reads an error event on both providers", () => {
    const openRouter = 'data: {"error":{"code":502,"message":"x","metadata":{"error_type":"provider_error"}}}\n';
    const openAi = 'data: {"error":{"code":"server_error","type":"api_error"}}\n';
    expect(parseSseChunk(openRouter + openAi).events).toEqual([
      { type: "error", status: 502, code: "provider_error" },
      { type: "error", status: null, code: "server_error" },
    ]);
  });
});

describe("completeStream", () => {
  const encoder = new TextEncoder();
  const delta = (content: string, finish: string | null = null) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] })}\n\n`;

  /** A body the test pushes chunks into; it errors when the request is aborted, like a real fetch. */
  function sseBody(signal?: AbortSignal) {
    let push!: (chunk: string) => void;
    let end!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (chunk) => controller.enqueue(encoder.encode(chunk));
        end = () => controller.close();
        signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
      },
    });
    return { body, push: (chunk: string) => push(chunk), end: () => end() };
  }

  /** Answers the next fetch with a body to push into. */
  function streaming() {
    let feed!: ReturnType<typeof sseBody>;
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      feed = sseBody(init.signal ?? undefined);
      return new Response(feed.body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    });
    return () => feed;
  }

  async function readAll(stream: ReadableStream<string>) {
    const reader = stream.getReader();
    let text = "";
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) text += chunk.value;
    return text;
  }

  afterEach(() => vi.useRealTimers());

  it("posts with stream: true and joins the deltas", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(": OPENROUTER PROCESSING\n\n");
    feed().push(delta("Hel"));
    const ai = await started;
    feed().push(delta("lo"));
    feed().push(delta("!", "stop") + "data: [DONE]\n\n");
    feed().end();

    expect(await readAll(ai.stream)).toBe("Hello!");
    expect(ai.finishReason()).toBe("stop");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ stream: true, max_tokens: 300 });
  });

  it("sends stream: true to OpenAI too", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("ok", "stop"));
    feed().end();
    await readAll((await started).stream);

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ stream: true, max_completion_tokens: 300 });
  });

  it("reports a cut-off answer through finishReason", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("Half a ", null) + delta("rew", "length") + "data: [DONE]\n\n");
    const ai = await started;
    feed().end();

    expect(await readAll(ai.stream)).toBe("Half a rew");
    expect(ai.finishReason()).toBe("length");
  });

  it("maps an error status as complete does", async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 429, message: "slow down" } }, { "Retry-After": "20" }));

    const error = await completeStream(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ status: 429, retryAfter: 20 });
    expect(await aiErrorMessage(error)).toBe("AI is busy. Try again in 20 seconds.");
  });

  it("throws on an error event before any text", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push('data: {"error":{"code":503,"metadata":{"error_type":"provider_unavailable"}}}\n\n');

    expect(await started).toMatchObject({ status: 503, code: "provider_unavailable" });
  });

  it("throws when the answer ends with no text, as complete does", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("", "length") + "data: [DONE]\n\n");

    expect(await started).toMatchObject({ status: null, code: "length" });
  });

  it("errors the stream on an error event after text", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("Part"));
    const ai = await started;
    feed().push('data: {"error":{"code":502,"message":"upstream"}}\n\n');

    const error = await readAll(ai.stream).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ status: 502 });
  });

  it("times out when the first token takes too long, keep-alives notwithstanding", async () => {
    vi.useFakeTimers();
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    for (let second = 0; second < 50; second += 10) {
      feed().push(": OPENROUTER PROCESSING\n\n");
      await vi.advanceTimersByTimeAsync(10_000);
    }
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await started).toMatchObject({ status: 408, code: "timeout" });
  });

  it("lets the caller allow a shorter first-token wait", async () => {
    vi.useFakeTimers();
    streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300, timeoutMs: 5_000 }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await started).toMatchObject({ status: 408, code: "timeout" });
  });

  it("never cuts an answer that keeps coming, but gives up after 30 s of silence", async () => {
    vi.useFakeTimers();
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("a"));
    const ai = await started;
    const read = readAll(ai.stream).catch((caught: unknown) => caught);

    // Three minutes of text, a chunk every 20 s: well past the first-token timeout.
    for (let chunk = 0; chunk < 9; chunk++) {
      await vi.advanceTimersByTimeAsync(20_000);
      feed().push(delta("a"));
    }
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await read).toMatchObject({ status: 408, code: "timeout" });
  });

  it("stops the upstream call when the stream is cancelled", async () => {
    const feed = streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    feed().push(delta("a"));
    const ai = await started;

    await ai.stream.cancel();

    expect((fetchMock.mock.calls[0]![1].signal as AbortSignal).aborted).toBe(true);
  });

  it("stops the upstream call when the caller aborts", async () => {
    const caller = new AbortController();
    streaming();
    const started = completeStream(MESSAGES, { maxTokens: 300, signal: caller.signal }).catch((caught: unknown) => caught);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    caller.abort();

    expect(await started).toMatchObject({ status: null, code: "aborted" });
    expect((fetchMock.mock.calls[0]![1].signal as AbortSignal).aborted).toBe(true);
  });

  it("maps a network failure as complete does", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    expect(await completeStream(MESSAGES, { maxTokens: 300 }).catch((caught: unknown) => caught)).toMatchObject({
      status: null,
      code: "network",
    });
  });
});

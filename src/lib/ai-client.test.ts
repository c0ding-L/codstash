import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiProviderError, aiErrorMessage, complete, parseRetryAfter, type AiMessage } from "@/lib/ai-client";

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

describe("aiErrorMessage", () => {
  const error = (status: number | null, code: string | null = null, retryAfter: number | null = null) =>
    new AiProviderError({ provider: "openrouter", status, code, retryAfter, message: "x" });

  it("maps each status to its message", () => {
    expect(aiErrorMessage(error(400))).toBe("AI request failed.");
    expect(aiErrorMessage(error(401))).toBe("AI is unavailable right now.");
    expect(aiErrorMessage(error(402))).toBe("AI is unavailable right now.");
    expect(aiErrorMessage(error(403))).toBe("The AI declined this content.");
    expect(aiErrorMessage(error(404))).toBe("AI is unavailable right now.");
    expect(aiErrorMessage(error(408))).toBe("AI took too long. Try again.");
    expect(aiErrorMessage(error(504))).toBe("AI took too long. Try again.");
    for (const status of [500, 502, 503]) {
      expect(aiErrorMessage(error(status))).toBe("AI is unavailable right now. Try again.");
    }
  });

  it("says how long to wait on a rate-limit 429", () => {
    expect(aiErrorMessage(error(429, null, 1))).toBe("AI is busy. Try again in 1 second.");
    expect(aiErrorMessage(error(429, null, 20))).toBe("AI is busy. Try again in 20 seconds.");
    expect(aiErrorMessage(error(429, null, 90))).toBe("AI is busy. Try again in 2 minutes.");
    expect(aiErrorMessage(error(429))).toBe("AI is busy. Try again in a minute.");
  });

  it("never says try again on a spend-limit or out-of-credits 429", () => {
    for (const code of ["project_spend_limit_exceeded", "organization_spend_limit_exceeded", "insufficient_quota"]) {
      expect(aiErrorMessage(error(429, code, 30))).toBe("AI is unavailable right now.");
    }
  });

  it("reads an empty answer, a network failure or any other error as unavailable", () => {
    expect(aiErrorMessage(error(null, "length"))).toBe("AI is unavailable right now. Try again.");
    expect(aiErrorMessage(new Error("OPENROUTER_API_KEY is not set"))).toBe("AI is unavailable right now.");
  });
});

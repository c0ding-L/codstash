// Thin client for the AI features: one Chat Completions call, whole (`complete`) or streamed
// (`completeStream`).
// Server-only: it reads the API keys from the environment. The provider is
// picked by `AI_PROVIDER`, so moving from OpenRouter to OpenAI is a change of
// env vars, not of code. Everything provider-specific is in `ADAPTERS`.

import { getTranslations } from "next-intl/server";

/** How long a call may take unless the caller allows more. */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Error bodies can be whole HTML pages; keep only an excerpt. */
const MAX_ERROR_BODY = 300;

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Adapter {
  url: string;
  keyEnv: string;
  defaultModel: string;
  body(model: string, messages: AiMessage[], maxTokens: number, stream?: boolean): Record<string, unknown>;
}

const ADAPTERS = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    // Free models only on OpenRouter: an id without `:free` is billed.
    defaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    body: (model, messages, maxTokens, stream = false) => ({
      model,
      messages,
      max_tokens: maxTokens,
      ...(stream && { stream: true }),
      temperature: 0.2,
      // Reasoning tokens count against `max_tokens`; low effort leaves room for the answer.
      reasoning: { effort: "low", exclude: true },
    }),
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-6-luna",
    // No `temperature`: not listed for Luna. The default reasoning effort spends output tokens for nothing.
    body: (model, messages, maxTokens, stream = false) => ({
      model,
      messages,
      max_completion_tokens: maxTokens,
      ...(stream && { stream: true }),
      reasoning_effort: "none",
    }),
  },
} satisfies Record<string, Adapter>;

export type AiProvider = keyof typeof ADAPTERS;

function isProvider(value: string): value is AiProvider {
  return Object.hasOwn(ADAPTERS, value);
}

/** Read at call time. An empty variable means "use the default", hence `||`. */
function config() {
  const provider = process.env.AI_PROVIDER || "openrouter";
  if (!isProvider(provider)) throw new Error(`Unknown AI_PROVIDER "${provider}"`);
  const adapter: Adapter = ADAPTERS[provider];
  const apiKey = process.env[adapter.keyEnv];
  if (!apiKey) throw new Error(`${adapter.keyEnv} is not set`);
  return { provider, adapter, apiKey, model: process.env.AI_MODEL || adapter.defaultModel };
}

export class AiProviderError extends Error {
  readonly provider: AiProvider;
  /** The HTTP status, or the one in the error body; null when there was no answer to read. */
  readonly status: number | null;
  /** The provider's error code or type, e.g. `insufficient_quota`. */
  readonly code: string | null;
  /** Seconds, from `Retry-After`. */
  readonly retryAfter: number | null;

  constructor(init: {
    provider: AiProvider;
    status: number | null;
    code: string | null;
    retryAfter?: number | null;
    message: string;
  }) {
    super(init.message);
    this.name = "AiProviderError";
    this.provider = init.provider;
    this.status = init.status;
    this.code = init.code;
    this.retryAfter = init.retryAfter ?? null;
  }
}

/** `Retry-After` as whole seconds: either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(1, Math.ceil((date - now) / 1000));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * The top-level `error` of a response body, on both providers: OpenRouter puts
 * the HTTP status in `error.code` and the kind in `error.metadata.error_type`;
 * OpenAI puts a string in `error.code` and the kind in `error.type`.
 */
function readError(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, type, metadata } = body.error;
  const errorType = isRecord(metadata) ? metadata.error_type : undefined;
  return {
    status: typeof code === "number" ? code : null,
    code:
      typeof code === "string"
        ? code
        : typeof errorType === "string"
          ? errorType
          : typeof type === "string"
            ? type
            : null,
  };
}

/** `text` as JSON, or null when it is not JSON. */
function parseJsonQuietly(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The error for a provider's failed answer, logged with the start of its body. */
function httpError(provider: AiProvider, response: Response, text: string, body: unknown, status: number) {
  console.error(`[ai] ${provider} answered ${status}: ${text.slice(0, MAX_ERROR_BODY)}`);
  return new AiProviderError({
    provider,
    status,
    code: readError(body)?.code ?? null,
    retryAfter: parseRetryAfter(response.headers.get("retry-after")),
    message: `${provider} request failed with ${status}`,
  });
}

/**
 * The answer's text, trimmed. Throws `AiProviderError` on any failure, including an empty answer.
 * With `rejectCutOff`, an answer that stopped on the token cap (`finish_reason: "length"`) is an
 * error too, for callers that would otherwise save a half-written text.
 */
export async function complete(
  messages: AiMessage[],
  {
    maxTokens,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    rejectCutOff = false,
  }: { maxTokens: number; timeoutMs?: number; rejectCutOff?: boolean },
): Promise<string> {
  const { provider, adapter, apiKey, model } = config();

  let response: Response;
  let text: string;
  try {
    response = await fetch(adapter.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(adapter.body(model, messages, maxTokens)),
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await response.text();
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(`[ai] ${provider} request failed:`, error);
    throw new AiProviderError({
      provider,
      status: timedOut ? 408 : null,
      code: timedOut ? "timeout" : "network",
      message: `${provider} request ${timedOut ? "timed out" : "failed"}`,
    });
  }

  // Not JSON: handled as an error or an empty answer below.
  const body = parseJsonQuietly(text);

  // OpenRouter can answer 200 with an error in the body, so this comes before `choices`.
  const bodyError = readError(body);
  if (!response.ok || bodyError) {
    throw httpError(provider, response, text, body, response.ok ? (bodyError?.status ?? 502) : response.status);
  }

  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  const answer = typeof content === "string" ? content.trim() : "";
  if (!answer) {
    // Reasoning can use up the token cap, leaving no text: an error, never "no result".
    const finishReason = isRecord(choice) ? choice.finish_reason : undefined;
    console.error(`[ai] ${provider} gave an empty answer (finish_reason: ${String(finishReason)})`);
    throw new AiProviderError({
      provider,
      status: null,
      code: finishReason === "length" ? "length" : "empty_response",
      message: `${provider} gave an empty answer`,
    });
  }
  if (rejectCutOff && isRecord(choice) && choice.finish_reason === "length") {
    console.error(`[ai] ${provider} answer was cut off at the token cap`);
    throw new AiProviderError({
      provider,
      status: null,
      code: CUT_OFF_CODE,
      message: `${provider} answer was cut off`,
    });
  }
  return answer;
}

/** The `AiProviderError` code of an answer cut off by `rejectCutOff`. */
export const CUT_OFF_CODE = "cut_off";

/** How long a streamed call may wait for its first token unless the caller allows more or less. */
export const STREAM_FIRST_TOKEN_TIMEOUT_MS = 60_000;
/** Once text flows, how long the stream may go quiet before it is given up on. */
export const STREAM_IDLE_TIMEOUT_MS = 30_000;

/** What one Server-Sent Events line of a streamed Chat Completion carries. */
export type SseEvent =
  | { type: "text"; text: string }
  | { type: "finish"; reason: string }
  | { type: "error"; status: number | null; code: string | null }
  | { type: "done" };

/**
 * The events in the complete lines of `buffer`, and the incomplete last line to prepend to the
 * next chunk. Comment lines (`: OPENROUTER PROCESSING` keep-alives), blank lines, other fields and
 * unreadable JSON give no event.
 */
export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: SseEvent[] = [];
  for (const raw of lines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      events.push({ type: "done" });
      continue;
    }
    let body: unknown;
    try {
      body = JSON.parse(data);
    } catch {
      continue;
    }
    const error = readError(body);
    if (error) {
      events.push({ type: "error", ...error });
      continue;
    }
    const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
    if (!isRecord(choice)) continue;
    const content = isRecord(choice.delta) ? choice.delta.content : undefined;
    if (typeof content === "string" && content) events.push({ type: "text", text: content });
    if (typeof choice.finish_reason === "string") events.push({ type: "finish", reason: choice.finish_reason });
  }
  return { events, rest };
}

/** A streamed answer: its text deltas, and why it ended once `stream` has closed. */
export interface AiStream {
  stream: ReadableStream<string>;
  /** The last `finish_reason` seen, e.g. `"length"` on the token cap; null before the end or if none came. */
  finishReason(): string | null;
}

/**
 * One streamed Chat Completion. Resolves once the first text arrives, so everything that fails
 * before (an error status, an error event, no text at all, the first-token timeout) throws
 * `AiProviderError` with the same codes as `complete`. After that, a failure errors the stream
 * with an `AiProviderError`. `timeoutMs` covers the wait for the first token; afterwards the
 * stream may go quiet for at most `STREAM_IDLE_TIMEOUT_MS` between chunks, so a long answer that
 * keeps coming is never cut. Cancelling the stream or aborting `signal` stops the upstream call.
 */
export async function completeStream(
  messages: AiMessage[],
  {
    maxTokens,
    timeoutMs = STREAM_FIRST_TOKEN_TIMEOUT_MS,
    signal,
  }: { maxTokens: number; timeoutMs?: number; signal?: AbortSignal },
): Promise<AiStream> {
  const { provider, adapter, apiKey, model } = config();

  const controller = new AbortController();
  // Set once the answer has a body.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Cancelling the reader too ends a read that waits, whatever the fetch does with the abort.
  const abort = () => {
    controller.abort();
    void reader?.cancel().catch(() => {});
  };
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      abort();
    }, ms);
  };
  const onCallerAbort = () => abort();
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  };
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onCallerAbort, { once: true });
  arm(timeoutMs);

  /** A network failure or an abort, as `complete` reports them. */
  const transportError = (error: unknown) => {
    // The user stopping, or leaving, is not a failure worth a log.
    if (timedOut || !signal?.aborted) console.error(`[ai] ${provider} stream failed:`, error);
    return new AiProviderError({
      provider,
      status: timedOut ? 408 : null,
      code: timedOut ? "timeout" : signal?.aborted ? "aborted" : "network",
      message: `${provider} stream ${timedOut ? "timed out" : "failed"}`,
    });
  };
  const eventError = (event: { status: number | null; code: string | null }) => {
    console.error(`[ai] ${provider} stream sent an error: ${event.status ?? "?"} ${event.code ?? ""}`);
    return new AiProviderError({
      provider,
      status: event.status ?? 502,
      code: event.code,
      message: `${provider} stream failed with ${event.status ?? 502}`,
    });
  };

  let response: Response;
  try {
    response = await fetch(adapter.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(adapter.body(model, messages, maxTokens, true)),
      signal: controller.signal,
    });
  } catch (error) {
    cleanup();
    throw transportError(error);
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    cleanup();
    // Not JSON: the status alone says what went wrong.
    throw httpError(provider, response, text, parseJsonQuietly(text), response.ok ? 502 : response.status);
  }

  const body = response.body.getReader();
  reader = body;
  const decoder = new TextDecoder();
  let buffer = "";
  let finishReason: string | null = null;
  let ended = false;
  const pending: string[] = [];

  /** Reads one chunk into `pending`. Throws `AiProviderError` on an error event or a failed read. */
  async function readChunk(): Promise<void> {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await body.read();
    } catch (error) {
      throw transportError(error);
    }
    // A cancelled read ends as if the answer had: it is the timeout or the caller's abort.
    if (controller.signal.aborted) throw transportError(controller.signal.reason);
    buffer += chunk.done ? decoder.decode() + "\n" : decoder.decode(chunk.value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const event of events) {
      if (event.type === "text") pending.push(event.text);
      else if (event.type === "finish") finishReason = event.reason;
      else if (event.type === "error") throw eventError(event);
      else ended = true;
    }
    if (chunk.done) ended = true;
  }

  const stop = () => {
    cleanup();
    abort();
  };

  // Up to the first text: keep-alive comments do not count, so they do not hold off the timeout.
  try {
    while (pending.length === 0 && !ended) await readChunk();
  } catch (error) {
    stop();
    throw error;
  }
  if (pending.length === 0) {
    stop();
    // Reasoning can use up the token cap, leaving no text: an error, never "no result".
    console.error(`[ai] ${provider} streamed an empty answer (finish_reason: ${String(finishReason)})`);
    throw new AiProviderError({
      provider,
      status: null,
      code: finishReason === "length" ? "length" : "empty_response",
      message: `${provider} gave an empty answer`,
    });
  }
  clearTimeout(timer);

  const stream = new ReadableStream<string>({
    async pull(out) {
      try {
        // The idle timer runs only while a read waits, so a slow reader of this stream never trips it.
        while (pending.length === 0 && !ended) {
          arm(STREAM_IDLE_TIMEOUT_MS);
          await readChunk();
          clearTimeout(timer);
        }
        const next = pending.shift();
        if (next !== undefined) out.enqueue(next);
        else {
          stop();
          out.close();
        }
      } catch (error) {
        stop();
        out.error(error);
      }
    },
    cancel() {
      stop();
    },
  });

  return { stream, finishReason: () => finishReason };
}

/** 429s that waiting a few seconds does not fix: spend limits and an empty balance. */
const OUT_OF_BUDGET_CODES: ReadonlySet<string> = new Set([
  "project_spend_limit_exceeded",
  "organization_spend_limit_exceeded",
  "insufficient_quota",
]);

/**
 * What the user is told when an AI call fails, in the request's language. Anything that is not an
 * `AiProviderError` reads as unavailable.
 */
export async function aiErrorMessage(error: unknown): Promise<string> {
  return (await aiErrorMessages())(error);
}

/**
 * `aiErrorMessage` with the translations loaded up front, for a failure in a streamed body, which
 * can happen after the route has returned.
 */
export async function aiErrorMessages(): Promise<(error: unknown) => string> {
  const t = await getTranslations("errors.ai");
  return (error) => {
    if (!(error instanceof AiProviderError)) return t("unavailable");
    if (error.code === CUT_OFF_CODE) return t("cutOff");

    const busy = (retryAfter: number | null) => {
      if (retryAfter === null) return t("busyMinute");
      if (retryAfter < 60) return t("busySeconds", { seconds: retryAfter });
      return t("busyMinutes", { minutes: Math.ceil(retryAfter / 60) });
    };

    switch (error.status) {
      case 400:
        return t("requestFailed");
      case 401:
      case 402:
      case 404:
        return t("unavailable");
      case 403:
        return t("declined");
      case 408:
      case 504:
        return t("timeout");
      case 429:
        return error.code !== null && OUT_OF_BUDGET_CODES.has(error.code) ? t("unavailable") : busy(error.retryAfter);
      default:
        return t("unavailableTryAgain");
    }
  };
}

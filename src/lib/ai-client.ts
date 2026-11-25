// Thin client for the AI features: one non-streaming Chat Completions call.
// Server-only: it reads the API keys from the environment. The provider is
// picked by `AI_PROVIDER`, so moving from OpenRouter to OpenAI is a change of
// env vars, not of code. Everything provider-specific is in `ADAPTERS`.

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
  body(model: string, messages: AiMessage[], maxTokens: number): Record<string, unknown>;
}

const ADAPTERS = {
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    // Free models only on OpenRouter: an id without `:free` is billed.
    defaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    body: (model, messages, maxTokens) => ({
      model,
      messages,
      max_tokens: maxTokens,
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
    body: (model, messages, maxTokens) => ({
      model,
      messages,
      max_completion_tokens: maxTokens,
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

/** The answer's text, trimmed. Throws `AiProviderError` on any failure, including an empty answer. */
export async function complete(
  messages: AiMessage[],
  { maxTokens, timeoutMs = DEFAULT_TIMEOUT_MS }: { maxTokens: number; timeoutMs?: number },
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

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: handled as an error or an empty answer below.
  }

  // OpenRouter can answer 200 with an error in the body, so this comes before `choices`.
  const bodyError = readError(body);
  if (!response.ok || bodyError) {
    const status = response.ok ? (bodyError?.status ?? 502) : response.status;
    console.error(`[ai] ${provider} answered ${status}: ${text.slice(0, MAX_ERROR_BODY)}`);
    throw new AiProviderError({
      provider,
      status,
      code: bodyError?.code ?? null,
      retryAfter: parseRetryAfter(response.headers.get("retry-after")),
      message: `${provider} request failed with ${status}`,
    });
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
  return answer;
}

const UNAVAILABLE = "AI is unavailable right now.";
const UNAVAILABLE_TRY_AGAIN = "AI is unavailable right now. Try again.";

/** 429s that waiting a few seconds does not fix: spend limits and an empty balance. */
const OUT_OF_BUDGET_CODES: ReadonlySet<string> = new Set([
  "project_spend_limit_exceeded",
  "organization_spend_limit_exceeded",
  "insufficient_quota",
]);

function busyMessage(retryAfter: number | null) {
  if (retryAfter === null) return "AI is busy. Try again in a minute.";
  if (retryAfter < 60) return `AI is busy. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`;
  const minutes = Math.ceil(retryAfter / 60);
  return `AI is busy. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** What the user is told when an AI call fails. Anything that is not an `AiProviderError` reads as unavailable. */
export function aiErrorMessage(error: unknown): string {
  if (!(error instanceof AiProviderError)) return UNAVAILABLE;
  switch (error.status) {
    case 400:
      return "AI request failed.";
    case 401:
    case 402:
    case 404:
      return UNAVAILABLE;
    case 403:
      return "The AI declined this content.";
    case 408:
    case 504:
      return "AI took too long. Try again.";
    case 429:
      return error.code !== null && OUT_OF_BUDGET_CODES.has(error.code) ? UNAVAILABLE : busyMessage(error.retryAfter);
    default:
      return UNAVAILABLE_TRY_AGAIN;
  }
}

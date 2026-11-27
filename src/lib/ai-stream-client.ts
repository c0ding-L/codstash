// The browser side of the streamed AI routes (`/api/ai/explain`, `/api/ai/optimize`, `/api/ai/summarize`).

import { readStreamedAnswer, visibleStreamedText } from "@/lib/ai-stream-protocol";

/** Thrown with the message to show: the server's, or `failedMessage` when it sent none. */
export class AiStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiStreamError";
  }
}

export interface StreamAiOptions {
  /** Called with the text so far, at most once per animation frame, and once more with the whole text. */
  onText: (text: string) => void;
  /** Aborting it stops the stream (and the upstream call); the promise then rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** The message for a failure the server did not word: a network error, or an answer that is not JSON. */
  failedMessage: string;
  /** Called with the response's headers once the answer has started (a 200). */
  onHeaders?: (headers: Headers) => void;
}

/** One frame in the browser; a short timeout elsewhere. */
const nextFrame: (callback: () => void) => void =
  typeof requestAnimationFrame === "function" ? (callback) => requestAnimationFrame(callback) : (callback) => setTimeout(callback, 16);

/**
 * Posts `body` to an AI route and reads its streamed answer. Resolves with the whole text, without
 * its end marker, and whether it was cut off. Rejects with `AiStreamError` on an error answer or
 * a failure midway (after a last `onText` with the text that came), and with an `AbortError`
 * when `signal` is aborted.
 */
export async function streamAi(
  url: string,
  body: unknown,
  { onText, signal, failedMessage, onHeaders }: StreamAiOptions,
): Promise<{ text: string; cutOff: boolean }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AiStreamError(failedMessage);
  }

  if (!response.ok || !response.body) {
    const answer: { error?: unknown } = await response.json().catch(() => ({}));
    throw new AiStreamError(typeof answer.error === "string" && answer.error ? answer.error : failedMessage);
  }

  onHeaders?.(response.headers);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = "";
  let scheduled = false;
  let finished = false;
  const flush = () => onText(visibleStreamedText(received));

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
      if (!scheduled) {
        scheduled = true;
        nextFrame(() => {
          scheduled = false;
          if (!finished) flush();
        });
      }
    }
    received += decoder.decode();
  } catch (error) {
    finished = true;
    flush();
    if (signal?.aborted) throw error;
    throw new AiStreamError(failedMessage);
  }

  finished = true;
  const { text, cutOff, error } = readStreamedAnswer(received);
  onText(text);
  if (error !== null) throw new AiStreamError(error);
  return { text, cutOff };
}

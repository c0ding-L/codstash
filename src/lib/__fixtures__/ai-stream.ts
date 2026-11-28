import { vi } from "vitest";

import type { AiStream } from "@/lib/ai-client";

/**
 * A streamed answer of these chunks, as `completeStream` returns it, then an optional failure.
 * Pulled one chunk at a time, so a failure comes after the text. `cancel` spies on the reader
 * being cancelled (the user stopped, or the route cut the answer).
 */
export function fakeAiStream(
  chunks: string[],
  { finishReason = "stop", failWith }: { finishReason?: string; failWith?: unknown } = {},
): AiStream & { cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn();
  const queue = [...chunks];
  const stream = new ReadableStream<string>({
    pull(controller) {
      const next = queue.shift();
      if (next !== undefined) controller.enqueue(next);
      else if (failWith) controller.error(failWith);
      else controller.close();
    },
    cancel,
  });
  return { stream, finishReason: () => finishReason, cancel };
}

/** A rate limit that lets the call through. */
export function allowedLimit() {
  return { success: true, remaining: 1, reset: 0 };
}

/** A rate limit that refuses it for another minute. */
export function blockedLimit() {
  return { success: false, remaining: 0, reset: Date.now() + 60_000 };
}

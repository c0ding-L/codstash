"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { parseStreamingExplanation } from "@/lib/ai-output";
import { AiStreamError, streamAi } from "@/lib/ai-stream-client";

/** Where the answer is: still arriving, whole, stopped by the user, or cut short. */
export type AiAnswerStatus = "streaming" | "done" | "stopped" | "cutOff";

interface AiAnswerStreamOptions {
  /** The streamed AI route, e.g. `/api/ai/explain`. */
  url: string;
  failedMessage: string;
  /** Shown when the whole answer is empty. */
  emptyMessage: string;
  onHeaders?: (headers: Headers) => void;
}

/**
 * A Markdown answer streamed from an AI route (`ai-stream-protocol.ts`). A route, not a server
 * action, so the drawer's other actions stay usable. `text` is null until `start`, and again
 * when the answer came back empty or was reset. Unmounting stops the call.
 */
export function useAiAnswerStream({ url, failedMessage, emptyMessage, onHeaders }: AiAnswerStreamOptions) {
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<AiAnswerStatus>("done");
  // The running request; also keeps a double click from spending two.
  const request = useRef<AbortController | null>(null);

  // A drawer that closes or moves to another item stops the call.
  useEffect(() => () => request.current?.abort(), []);

  async function start(body: unknown) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setText("");
    setStatus("streaming");
    // A stopped or failed request keeps what came; with nothing, `text` is null again.
    const keepPartial = (next: AiAnswerStatus) => {
      setText((current) => (current ? current : null));
      setStatus(next);
    };
    try {
      const { text: answer, cutOff } = await streamAi(url, body, {
        signal: controller.signal,
        failedMessage,
        onHeaders,
        onText: (partial) => setText(parseStreamingExplanation(partial)),
      });
      const whole = parseStreamingExplanation(answer);
      if (!whole) {
        toast.error(emptyMessage);
        setText(null);
        setStatus("done");
        return;
      }
      setText(whole);
      setStatus(cutOff ? "cutOff" : "done");
    } catch (error) {
      if (controller.signal.aborted) {
        keepPartial("stopped");
        return;
      }
      toast.error(error instanceof AiStreamError ? error.message : failedMessage);
      keepPartial("cutOff");
    } finally {
      request.current = null;
    }
  }

  function stop() {
    request.current?.abort();
  }

  /** Stops the call and drops the answer. */
  function reset() {
    request.current?.abort();
    setText(null);
    setStatus("done");
  }

  return { text, status, streaming: status === "streaming", start, stop, reset };
}

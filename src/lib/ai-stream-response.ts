// What the streamed AI routes (`/api/ai/explain`, `/optimize`, `/summarize`) share. Server-only.

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { errKey, type ErrorKey } from "@/i18n/error-keys";
import { getErrors, type Errors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessages, completeStream, type AiMessage, type AiStream } from "@/lib/ai-client";
import { CUT_OFF_MARKER, errorMarker } from "@/lib/ai-stream-protocol";

/**
 * When a route stops its stream itself: 10 s before the platform would kill it at the routes'
 * `maxDuration` of 120 s (a literal in each route, as segment config must be).
 */
export const AI_ROUTE_DEADLINE_MS = 110_000;

/** The body every AI route takes: the saved item, which the server reads by owner. */
export const aiItemSchema = z.object({
  itemId: z.string().trim().min(1, errKey("ai.itemNotFound")).max(100, errKey("ai.itemNotFound")),
});

/** The request's JSON body, or null when it is not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** A refusal, as `{ error }` with the message to show. */
export const aiError = (status: number, error: string) => NextResponse.json({ error }, { status });

export interface AiStreamResponseOptions {
  /** Forward at most this many characters, then end with the cut-off marker (Explain's cap). */
  maxChars?: number;
  /**
   * When (ms since the epoch) to stop and end with the cut-off marker, ahead of the route's
   * `maxDuration`: a function killed by the platform ends without a marker, which would read as
   * a whole answer.
   */
  deadline?: number;
  /** The message for a failure once the text has started, translated ahead of time. */
  errorMessage: (error: unknown) => string;
}

/**
 * A `200 text/plain` response that forwards the answer's text as it comes, ending with a marker
 * (`ai-stream-protocol.ts`) when it was cut off or failed midway. Cancelling the response (the
 * user stopped, or left) cancels the upstream call.
 */
export function aiStreamResponse(ai: AiStream, { maxChars = Infinity, deadline = Infinity, errorMessage }: AiStreamResponseOptions) {
  const encoder = new TextEncoder();
  const reader = ai.stream.getReader();
  let sent = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const body = new ReadableStream<Uint8Array>({
    async pull(out) {
      const end = (marker = "") => {
        clearTimeout(timer);
        if (marker) out.enqueue(encoder.encode(marker));
        out.close();
      };
      const stopUpstream = () => void reader.cancel().catch(() => {});

      try {
        const left = deadline - Date.now();
        const chunk =
          left <= 0
            ? null
            : await Promise.race([
                reader.read(),
                new Promise<null>((resolve) => {
                  timer = setTimeout(() => resolve(null), left);
                }),
              ]);
        clearTimeout(timer);

        if (chunk === null) {
          console.error("[ai] stream stopped at the route's deadline");
          stopUpstream();
          return end(CUT_OFF_MARKER);
        }
        if (chunk.done) return end(ai.finishReason() === "length" ? CUT_OFF_MARKER : "");

        if (sent + chunk.value.length > maxChars) {
          const kept = chunk.value.slice(0, maxChars - sent);
          if (kept) out.enqueue(encoder.encode(kept));
          stopUpstream();
          return end(CUT_OFF_MARKER);
        }
        sent += chunk.value.length;
        out.enqueue(encoder.encode(chunk.value));
      } catch (error) {
        // `completeStream` has logged the cause.
        end(errorMarker(errorMessage(error)));
      }
    },
    cancel() {
      clearTimeout(timer);
      return reader.cancel();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

interface AiItemRouteContext {
  userId: string;
  itemId: string;
  e: Errors;
  /** When the stream must stop, ahead of `maxDuration`. */
  deadline: number;
}

/**
 * The frame of an AI route: the deadline, the `{ itemId }` body, the session, and a 500 with
 * `failed` for anything the handler throws. The handler reads the item and runs `aiGate`
 * itself, before `streamAiAnswer`, so a request that cannot run spends no limiter slot.
 */
export async function withAiItemRoute(
  request: Request,
  { name, failed }: { name: string; failed: ErrorKey },
  handler: (context: AiItemRouteContext) => Promise<Response>,
): Promise<Response> {
  const deadline = Date.now() + AI_ROUTE_DEADLINE_MS;
  const e = await getErrors();
  const parsed = aiItemSchema.safeParse(await readJson(request));
  if (!parsed.success) return aiError(400, e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return aiError(401, e.message("notSignedIn"));
    return await handler({ userId: session.user.id, itemId: parsed.data.itemId, e, deadline });
  } catch (error) {
    console.error(`[ai] ${name} failed:`, error);
    return aiError(500, e.message(failed));
  }
}

interface StreamAiAnswerOptions {
  /** The route's name, for the logs. */
  name: string;
  messages: () => AiMessage[] | Promise<AiMessage[]>;
  maxTokens: number;
  maxChars?: number;
  deadline: number;
  /** Set on the streamed response only, never on a refusal. */
  headers?: Record<string, string>;
}

/** Calls the model and streams its answer, or a 502 with the provider's message when the call fails. */
export async function streamAiAnswer(
  request: Request,
  { name, messages, maxTokens, maxChars, deadline, headers }: StreamAiAnswerOptions,
): Promise<Response> {
  const errorMessage = await aiErrorMessages();
  try {
    const ai = await completeStream(await messages(), { maxTokens, signal: request.signal });
    const response = aiStreamResponse(ai, { maxChars, deadline, errorMessage });
    for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
    return response;
  } catch (error) {
    // The client logs the provider's own errors; a missing key or unknown provider is logged here.
    if (!(error instanceof AiProviderError)) console.error(`[ai] ${name} could not call the AI:`, error);
    return aiError(502, errorMessage(error));
  }
}

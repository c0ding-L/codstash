import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessages, completeStream } from "@/lib/ai-client";
import { aiGate } from "@/lib/ai-gate";
import { OPTIMIZE_CONTENT_LIMIT, OPTIMIZE_MAX_TOKENS, optimizePromptMessages } from "@/lib/ai-prompts";
import { AI_ROUTE_DEADLINE_MS, aiError, aiItemSchema, aiStreamResponse, readJson } from "@/lib/ai-stream-response";
import { getItemForExplain } from "@/lib/db/items";

/** A rewrite of a long prompt from the free model, plus its wait for the first token. */
export const maxDuration = 120;

/**
 * A refined version of a saved prompt, streamed as plain text as the model writes it
 * (`ai-stream-protocol.ts` for how it ends). The browser checks the finished text with
 * `parseOptimizedPrompt` before it offers it. The server reads the item itself, by owner; nothing
 * is saved: the drawer asks the user first, then calls `applyOptimizedPrompt`. Outside the
 * proxy's matcher, so the session is checked here.
 */
export async function POST(request: Request) {
  const deadline = Date.now() + AI_ROUTE_DEADLINE_MS;
  const e = await getErrors();
  const parsed = aiItemSchema.safeParse(await readJson(request));
  if (!parsed.success) return aiError(400, e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return aiError(401, e.message("notSignedIn"));

    // The item and its type before the gate, so a request that cannot run spends no limiter slot.
    const item = await getItemForExplain(session.user.id, parsed.data.itemId);
    if (!item) return aiError(404, e.message("ai.itemNotFound"));
    if (item.slug !== "prompt") return aiError(400, e.message("ai.onlyPrompts"));
    const content = item.content ?? "";
    if (!content.trim()) return aiError(400, e.message("ai.noPrompt"));
    // Refused rather than truncated: the rewrite replaces the whole prompt, so the tail would be lost.
    if (content.length > OPTIMIZE_CONTENT_LIMIT) {
      return aiError(400, e.message("ai.promptTooLong", { max: OPTIMIZE_CONTENT_LIMIT }));
    }

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return aiError(blocked.status, blocked.error);

    const errorMessage = await aiErrorMessages();
    try {
      const ai = await completeStream(optimizePromptMessages(content), {
        maxTokens: OPTIMIZE_MAX_TOKENS,
        signal: request.signal,
      });
      return aiStreamResponse(ai, { deadline, errorMessage });
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) console.error("[ai] optimize could not call the AI:", error);
      return aiError(502, errorMessage(error));
    }
  } catch (error) {
    console.error("[ai] optimize failed:", error);
    return aiError(500, e.message("ai.optimizeFailed"));
  }
}

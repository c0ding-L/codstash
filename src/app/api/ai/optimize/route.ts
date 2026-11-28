import { aiGate } from "@/lib/ai-gate";
import { OPTIMIZE_CONTENT_LIMIT, OPTIMIZE_MAX_TOKENS, optimizePromptMessages } from "@/lib/ai-prompts";
import { aiError, streamAiAnswer, withAiItemRoute } from "@/lib/ai-stream-response";
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
  return withAiItemRoute(request, { name: "optimize", failed: "ai.optimizeFailed" }, async ({ userId, itemId, e, deadline }) => {
    // The item and its type before the gate, so a request that cannot run spends no limiter slot.
    const item = await getItemForExplain(userId, itemId);
    if (!item) return aiError(404, e.message("ai.itemNotFound"));
    if (item.slug !== "prompt") return aiError(400, e.message("ai.onlyPrompts"));
    const content = item.content ?? "";
    if (!content.trim()) return aiError(400, e.message("ai.noPrompt"));
    // Refused rather than truncated: the rewrite replaces the whole prompt, so the tail would be lost.
    if (content.length > OPTIMIZE_CONTENT_LIMIT) {
      return aiError(400, e.message("ai.promptTooLong", { max: OPTIMIZE_CONTENT_LIMIT }));
    }

    const blocked = await aiGate(userId, e);
    if (blocked) return aiError(blocked.status, blocked.error);

    return streamAiAnswer(request, {
      name: "optimize",
      messages: () => optimizePromptMessages(content),
      maxTokens: OPTIMIZE_MAX_TOKENS,
      deadline,
    });
  });
}

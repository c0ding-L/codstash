import { aiGate, answerLocale } from "@/lib/ai-gate";
import { EXPLANATION_MAX_LENGTH } from "@/lib/ai-output";
import { EXPLAIN_MAX_TOKENS, explainMessages } from "@/lib/ai-prompts";
import { aiError, streamAiAnswer, withAiItemRoute } from "@/lib/ai-stream-response";
import { isCodeType } from "@/lib/code-language";
import { getItemForExplain } from "@/lib/db/items";
import { toItemTypeSlug } from "@/lib/item-type-ui";

/** A long explanation from the free model, plus its wait for the first token. */
export const maxDuration = 120;

/**
 * A short Markdown explanation of a saved snippet or command, streamed as plain text as the model
 * writes it (`ai-stream-protocol.ts` for how it ends). The server reads the item itself, by owner;
 * nothing is saved. Outside the proxy's matcher, so the session is checked here.
 */
export async function POST(request: Request) {
  return withAiItemRoute(request, { name: "explain", failed: "ai.explainFailed" }, async ({ userId, itemId, e, deadline }) => {
    // The item and its type before the gate, so a request that cannot run spends no limiter slot.
    const item = await getItemForExplain(userId, itemId);
    if (!item) return aiError(404, e.message("ai.itemNotFound"));
    if (!isCodeType(toItemTypeSlug(item.slug))) return aiError(400, e.message("ai.onlyCode"));
    if (!item.content?.trim()) return aiError(400, e.message("ai.noCode"));
    const { content, language } = item;

    const blocked = await aiGate(userId, e);
    if (blocked) return aiError(blocked.status, blocked.error);

    return streamAiAnswer(request, {
      name: "explain",
      messages: async () => explainMessages({ content, language, locale: await answerLocale() }),
      maxTokens: EXPLAIN_MAX_TOKENS,
      maxChars: EXPLANATION_MAX_LENGTH,
      deadline,
    });
  });
}

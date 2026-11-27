import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessages, completeStream } from "@/lib/ai-client";
import { aiGate, answerLocale } from "@/lib/ai-gate";
import { EXPLANATION_MAX_LENGTH } from "@/lib/ai-output";
import { EXPLAIN_MAX_TOKENS, explainMessages } from "@/lib/ai-prompts";
import { AI_ROUTE_DEADLINE_MS, aiError, aiItemSchema, aiStreamResponse, readJson } from "@/lib/ai-stream-response";
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
    if (!isCodeType(toItemTypeSlug(item.slug))) return aiError(400, e.message("ai.onlyCode"));
    if (!item.content?.trim()) return aiError(400, e.message("ai.noCode"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return aiError(blocked.status, blocked.error);

    const errorMessage = await aiErrorMessages();
    try {
      const messages = explainMessages({ content: item.content, language: item.language, locale: await answerLocale() });
      const ai = await completeStream(messages, {
        maxTokens: EXPLAIN_MAX_TOKENS,
        signal: request.signal,
      });
      return aiStreamResponse(ai, { maxChars: EXPLANATION_MAX_LENGTH, deadline, errorMessage });
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) console.error("[ai] explain could not call the AI:", error);
      return aiError(502, errorMessage(error));
    }
  } catch (error) {
    console.error("[ai] explain failed:", error);
    return aiError(500, e.message("ai.explainFailed"));
  }
}

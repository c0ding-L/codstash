import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessages, completeStream } from "@/lib/ai-client";
import { aiGate, answerLocale } from "@/lib/ai-gate";
import { SUMMARY_MAX_LENGTH } from "@/lib/ai-output";
import { SUMMARY_CONTENT_LIMIT, SUMMARY_MAX_TOKENS, summaryMessages } from "@/lib/ai-prompts";
import { SECRET_WARNING_HEADER } from "@/lib/ai-stream-protocol";
import { AI_ROUTE_DEADLINE_MS, aiError, aiItemSchema, aiStreamResponse, readJson } from "@/lib/ai-stream-response";
import { getItemForSummary } from "@/lib/db/items";
import { getObject } from "@/lib/r2";
import { detectSecrets } from "@/lib/secrets";
import { canSummarize, readTextStart } from "@/lib/summarize";

/** A summary from the free model, plus its wait for the first token. */
export const maxDuration = 120;

/**
 * A short Markdown summary of a long note, prompt or text file, streamed as plain text as the model
 * writes it (`ai-stream-protocol.ts` for how it ends). The server reads the item itself, by owner,
 * and a file from R2; nothing is saved. Outside the proxy's matcher, so the session is checked here.
 */
export async function POST(request: Request) {
  const deadline = Date.now() + AI_ROUTE_DEADLINE_MS;
  const e = await getErrors();
  const parsed = aiItemSchema.safeParse(await readJson(request));
  if (!parsed.success) return aiError(400, e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return aiError(401, e.message("notSignedIn"));

    // The item before the gate, so a request that cannot run spends no limiter slot.
    const item = await getItemForSummary(session.user.id, parsed.data.itemId);
    if (!item) return aiError(404, e.message("ai.itemNotFound"));
    if (!canSummarize(item)) return aiError(400, e.message("ai.cannotSummarize"));

    // Before the file is read: an R2 read is paid for, so a Free user or one over the limits must
    // not get one. A missing or unreadable file then spends a slot, which is rare.
    const blocked = await aiGate(session.user.id, e);
    if (blocked) return aiError(blocked.status, blocked.error);

    let text: string;
    let truncated: boolean;
    if (item.slug === "file") {
      const object = item.fileUrl ? await getObject(item.fileUrl) : null;
      if (!object) return aiError(404, e.message("ai.fileMissing"));
      const read = await readTextStart(object.body, SUMMARY_CONTENT_LIMIT);
      if (!read) return aiError(400, e.message("ai.fileUnreadable"));
      ({ text, truncated } = read);
    } else {
      text = (item.content ?? "").trim();
      truncated = text.length > SUMMARY_CONTENT_LIMIT;
      text = text.slice(0, SUMMARY_CONTENT_LIMIT);
    }

    const errorMessage = await aiErrorMessages();
    try {
      const kind = item.slug === "file" ? "file" : item.slug === "prompt" ? "prompt" : "note";
      const messages = summaryMessages({
        title: item.title,
        kind,
        fileName: item.fileName,
        text,
        truncated,
        locale: await answerLocale(),
      });
      const ai = await completeStream(messages, { maxTokens: SUMMARY_MAX_TOKENS, signal: request.signal });
      const response = aiStreamResponse(ai, { maxChars: SUMMARY_MAX_LENGTH, deadline, errorMessage });
      // The browser checks a note's or prompt's text before calling; a file's it never has.
      if (kind === "file" && detectSecrets(text).length > 0) response.headers.set(SECRET_WARNING_HEADER, "1");
      return response;
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) console.error("[ai] summarize could not call the AI:", error);
      return aiError(502, errorMessage(error));
    }
  } catch (error) {
    console.error("[ai] summarize failed:", error);
    return aiError(500, e.message("ai.summarizeFailed"));
  }
}

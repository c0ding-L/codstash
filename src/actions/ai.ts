"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { AiProviderError, aiErrorMessage, complete } from "@/lib/ai-client";
import { NO_TAG_SUGGESTIONS, parseTagSuggestions } from "@/lib/ai-output";
import { TAG_MAX_TOKENS, tagSuggestionMessages } from "@/lib/ai-prompts";
import { getPlanStatus } from "@/lib/db/billing";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { checkRateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import { LIMIT_MESSAGES, canUseAi } from "@/lib/usage-limits";

export type AiResult<T> = { success: true; data: T; error: null } | { success: false; data: null; error: string };

/** What the item forms send: their current text, saved or not. */
export interface AutoTagsInput {
  title: string;
  content?: string | null;
  /** The tags already in the form. */
  tags: string[];
}

// The same caps as `createItem` / `updateItem`.
const autoTagsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a title first.")
    .max(ITEM_LIMITS.title, `Title can be at most ${ITEM_LIMITS.title} characters.`),
  content: z
    .string()
    .max(ITEM_LIMITS.content, `Content can be at most ${ITEM_LIMITS.content.toLocaleString("en-US")} characters.`)
    .nullable()
    .optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tags cannot be empty.")
        .max(ITEM_LIMITS.tag, `Each tag can be at most ${ITEM_LIMITS.tag} characters.`),
    )
    .max(ITEM_LIMITS.tags, `An item can have at most ${ITEM_LIMITS.tags} tags.`),
});

const failure = (error: string) => ({ success: false, data: null, error }) as const;

/**
 * The checks every AI action makes after auth: Pro first, so Free users spend
 * no limiter slots, then the per-user, daily and app-wide limits. The error
 * to show, or null to go ahead.
 */
async function aiGate(userId: string): Promise<string | null> {
  if (!canUseAi(await getPlanStatus(userId))) return LIMIT_MESSAGES.ai;

  const hourly = await checkRateLimit("ai", userId);
  if (!hourly.success) return tooManyAttemptsMessage(hourly.reset);
  const daily = await checkRateLimit("aiDaily", userId);
  if (!daily.success) return "You've used today's AI requests. Try again tomorrow.";
  const global = await checkRateLimit("aiGlobal", "global");
  if (!global.success) return "AI is busy, try again in a minute.";
  return null;
}

/** 3-5 new tags for the item in the form. Nothing is saved: the form adds the ones the user accepts. */
export async function generateAutoTags(input: AutoTagsInput): Promise<AiResult<string[]>> {
  const parsed = autoTagsSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const session = await auth();
    if (!session?.user?.id) return failure("You are not signed in.");

    const blocked = await aiGate(session.user.id);
    if (blocked) return failure(blocked);

    let answer: string;
    try {
      answer = await complete(tagSuggestionMessages(parsed.data), { maxTokens: TAG_MAX_TOKENS });
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] generateAutoTags could not call the AI:", error);
      }
      return failure(aiErrorMessage(error));
    }

    const tags = parseTagSuggestions(answer, parsed.data.tags);
    if (tags.length === 0) return failure(NO_TAG_SUGGESTIONS);
    return { success: true, data: tags, error: null };
  } catch (error) {
    console.error("[ai] generateAutoTags failed:", error);
    return failure("Could not suggest tags. Try again.");
  }
}

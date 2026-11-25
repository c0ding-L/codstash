"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { AiProviderError, aiErrorMessage, complete } from "@/lib/ai-client";
import {
  NO_DESCRIPTION,
  NO_EXPLANATION,
  NO_TAG_SUGGESTIONS,
  parseDescription,
  parseExplanation,
  parseTagSuggestions,
} from "@/lib/ai-output";
import {
  DESCRIPTION_MAX_TOKENS,
  EXPLAIN_MAX_TOKENS,
  EXPLAIN_TIMEOUT_MS,
  TAG_MAX_TOKENS,
  descriptionMessages,
  explainMessages,
  tagSuggestionMessages,
} from "@/lib/ai-prompts";
import { isCodeType } from "@/lib/code-language";
import { getPlanStatus } from "@/lib/db/billing";
import { getItemForExplain } from "@/lib/db/items";
import { toItemTypeSlug } from "@/lib/item-type-ui";
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

/** What the item forms send for a description: whatever fields the item's type has, saved or not. */
export interface DescriptionInput {
  /** The item type's slug, as a hint to the model. */
  type?: string | null;
  title: string;
  content?: string | null;
  language?: string | null;
  url?: string | null;
  /** The uploaded or chosen file's name, for files and images. */
  fileName?: string | null;
  tags: string[];
}

const shortText = (max: number) => z.string().max(max).nullable().optional();

// The URL is only context: a half-typed one is still worth sending, so it is capped, not validated.
const descriptionSchema = autoTagsSchema.extend({
  type: shortText(50),
  language: shortText(ITEM_LIMITS.language),
  url: shortText(2_048),
  fileName: shortText(255),
});

/** A 1-2 sentence description of the item in the form. Nothing is saved: the form fills its Description field. */
export async function generateDescription(input: DescriptionInput): Promise<AiResult<string>> {
  const parsed = descriptionSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const session = await auth();
    if (!session?.user?.id) return failure("You are not signed in.");

    const blocked = await aiGate(session.user.id);
    if (blocked) return failure(blocked);

    let answer: string;
    try {
      answer = await complete(descriptionMessages(parsed.data), { maxTokens: DESCRIPTION_MAX_TOKENS });
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] generateDescription could not call the AI:", error);
      }
      return failure(aiErrorMessage(error));
    }

    const description = parseDescription(answer);
    if (!description) return failure(NO_DESCRIPTION);
    return { success: true, data: description, error: null };
  } catch (error) {
    console.error("[ai] generateDescription failed:", error);
    return failure("Could not write a description. Try again.");
  }
}

const explainSchema = z.object({ itemId: z.string().trim().min(1, "Item not found.").max(100, "Item not found.") });

/**
 * A short Markdown explanation of a saved snippet or command. The server reads
 * the item itself, by owner; nothing is saved.
 */
export async function explainCode(input: { itemId: string }): Promise<AiResult<string>> {
  const parsed = explainSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const session = await auth();
    if (!session?.user?.id) return failure("You are not signed in.");

    const blocked = await aiGate(session.user.id);
    if (blocked) return failure(blocked);

    const item = await getItemForExplain(session.user.id, parsed.data.itemId);
    if (!item) return failure("Item not found.");
    if (!isCodeType(toItemTypeSlug(item.slug))) return failure("Only snippets and commands can be explained.");
    if (!item.content?.trim()) return failure("There is no code to explain.");

    let answer: string;
    try {
      answer = await complete(explainMessages({ content: item.content, language: item.language }), {
        maxTokens: EXPLAIN_MAX_TOKENS,
        timeoutMs: EXPLAIN_TIMEOUT_MS,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] explainCode could not call the AI:", error);
      }
      return failure(aiErrorMessage(error));
    }

    const explanation = parseExplanation(answer);
    if (!explanation) return failure(NO_EXPLANATION);
    return { success: true, data: explanation, error: null };
  } catch (error) {
    console.error("[ai] explainCode failed:", error);
    return failure("Could not explain this code. Try again.");
  }
}

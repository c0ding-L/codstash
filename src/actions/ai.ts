"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessage, complete } from "@/lib/ai-client";
import {
  parseDescription,
  parseExplanation,
  parseOptimizedPrompt,
  parseTagSuggestions,
} from "@/lib/ai-output";
import {
  DESCRIPTION_MAX_TOKENS,
  EXPLAIN_MAX_TOKENS,
  EXPLAIN_TIMEOUT_MS,
  OPTIMIZE_CONTENT_LIMIT,
  OPTIMIZE_MAX_TOKENS,
  OPTIMIZE_TIMEOUT_MS,
  TAG_MAX_TOKENS,
  descriptionMessages,
  explainMessages,
  optimizePromptMessages,
  tagSuggestionMessages,
} from "@/lib/ai-prompts";
import { isCodeType } from "@/lib/code-language";
import { getPlanStatus } from "@/lib/db/billing";
import { getItemForExplain } from "@/lib/db/items";
import { toItemTypeSlug } from "@/lib/item-type-ui";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locale";
import { checkRateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import { canUseAi } from "@/lib/usage-limits";

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
    .min(1, errKey("ai.addTitleFirst"))
    .max(ITEM_LIMITS.title, errKey("items.titleTooLong")),
  content: z
    .string()
    .max(ITEM_LIMITS.content, errKey("items.contentTooLong"))
    .nullable()
    .optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, errKey("items.tagEmpty"))
        .max(ITEM_LIMITS.tag, errKey("items.tagTooLong")),
    )
    .max(ITEM_LIMITS.tags, errKey("items.tooManyTags")),
});

const failure = (error: string) => ({ success: false, data: null, error }) as const;

/** The UI language, which the prose answers (Explain, Description) are written in. */
async function answerLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * The checks every AI action makes after auth: Pro first, so Free users spend
 * no limiter slots, then the per-user, daily and app-wide limits. The error
 * to show, or null to go ahead.
 */
async function aiGate(userId: string, e: Awaited<ReturnType<typeof getErrors>>): Promise<string | null> {
  if (!canUseAi(await getPlanStatus(userId))) return e.message("limits.ai");

  const hourly = await checkRateLimit("ai", userId);
  if (!hourly.success) return await tooManyAttemptsMessage(hourly.reset);
  const daily = await checkRateLimit("aiDaily", userId);
  if (!daily.success) return e.message("ai.dailyLimit");
  const global = await checkRateLimit("aiGlobal", "global");
  if (!global.success) return e.message("ai.busy");
  return null;
}

/** 3-5 new tags for the item in the form. Nothing is saved: the form adds the ones the user accepts. */
export async function generateAutoTags(input: AutoTagsInput): Promise<AiResult<string[]>> {
  const e = await getErrors();
  const parsed = autoTagsSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return failure(blocked);

    let answer: string;
    try {
      answer = await complete(tagSuggestionMessages(parsed.data), { maxTokens: TAG_MAX_TOKENS });
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] generateAutoTags could not call the AI:", error);
      }
      return failure(await aiErrorMessage(error));
    }

    const tags = parseTagSuggestions(answer, parsed.data.tags);
    if (tags.length === 0) return failure(e.message("ai.noTags"));
    return { success: true, data: tags, error: null };
  } catch (error) {
    console.error("[ai] generateAutoTags failed:", error);
    return failure(e.message("ai.tagsFailed"));
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
  const e = await getErrors();
  const parsed = descriptionSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return failure(blocked);

    let answer: string;
    try {
      answer = await complete(descriptionMessages({ ...parsed.data, locale: await answerLocale() }), {
        maxTokens: DESCRIPTION_MAX_TOKENS,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] generateDescription could not call the AI:", error);
      }
      return failure(await aiErrorMessage(error));
    }

    const description = parseDescription(answer);
    if (!description) return failure(e.message("ai.noDescription"));
    return { success: true, data: description, error: null };
  } catch (error) {
    console.error("[ai] generateDescription failed:", error);
    return failure(e.message("ai.descriptionFailed"));
  }
}

const itemIdSchema = z.object({
  itemId: z.string().trim().min(1, errKey("ai.itemNotFound")).max(100, errKey("ai.itemNotFound")),
});

/**
 * A short Markdown explanation of a saved snippet or command. The server reads
 * the item itself, by owner; nothing is saved.
 */
export async function explainCode(input: { itemId: string }): Promise<AiResult<string>> {
  const e = await getErrors();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return failure(blocked);

    const item = await getItemForExplain(session.user.id, parsed.data.itemId);
    if (!item) return failure(e.message("ai.itemNotFound"));
    if (!isCodeType(toItemTypeSlug(item.slug))) return failure(e.message("ai.onlyCode"));
    if (!item.content?.trim()) return failure(e.message("ai.noCode"));

    let answer: string;
    try {
      const messages = explainMessages({ content: item.content, language: item.language, locale: await answerLocale() });
      answer = await complete(messages, {
        maxTokens: EXPLAIN_MAX_TOKENS,
        timeoutMs: EXPLAIN_TIMEOUT_MS,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] explainCode could not call the AI:", error);
      }
      return failure(await aiErrorMessage(error));
    }

    const explanation = parseExplanation(answer);
    if (!explanation) return failure(e.message("ai.noExplanation"));
    return { success: true, data: explanation, error: null };
  } catch (error) {
    console.error("[ai] explainCode failed:", error);
    return failure(e.message("ai.explainFailed"));
  }
}

/**
 * A refined version of a saved prompt, or null when the model found nothing to improve. The
 * server reads the item itself, by owner; nothing is saved: the drawer asks the user first, then
 * calls `applyOptimizedPrompt`.
 */
export async function optimizePrompt(input: { itemId: string }): Promise<AiResult<string | null>> {
  const e = await getErrors();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return failure(blocked);

    const item = await getItemForExplain(session.user.id, parsed.data.itemId);
    if (!item) return failure(e.message("ai.itemNotFound"));
    if (item.slug !== "prompt") return failure(e.message("ai.onlyPrompts"));
    const content = item.content ?? "";
    if (!content.trim()) return failure(e.message("ai.noPrompt"));
    // Refused rather than truncated: the rewrite replaces the whole prompt, so the tail would be lost.
    if (content.length > OPTIMIZE_CONTENT_LIMIT) {
      return failure(e.message("ai.promptTooLong", { max: OPTIMIZE_CONTENT_LIMIT }));
    }

    let answer: string;
    try {
      answer = await complete(optimizePromptMessages(content), {
        maxTokens: OPTIMIZE_MAX_TOKENS,
        timeoutMs: OPTIMIZE_TIMEOUT_MS,
        rejectCutOff: true,
      });
    } catch (error) {
      if (!(error instanceof AiProviderError)) {
        console.error("[ai] optimizePrompt could not call the AI:", error);
      }
      return failure(await aiErrorMessage(error));
    }

    const result = parseOptimizedPrompt(answer, content);
    if (!result) return failure(e.message("ai.noOptimized"));
    return { success: true, data: result.changed ? result.prompt : null, error: null };
  } catch (error) {
    console.error("[ai] optimizePrompt failed:", error);
    return failure(e.message("ai.optimizeFailed"));
  }
}

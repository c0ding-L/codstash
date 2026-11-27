"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { AiProviderError, aiErrorMessage, complete } from "@/lib/ai-client";
import { aiGate, answerLocale } from "@/lib/ai-gate";
import { parseDescription, parseTagSuggestions } from "@/lib/ai-output";
import { DESCRIPTION_MAX_TOKENS, TAG_MAX_TOKENS, descriptionMessages, tagSuggestionMessages } from "@/lib/ai-prompts";
import { ITEM_LIMITS } from "@/lib/item-limits";

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

/** 3-5 new tags for the item in the form. Nothing is saved: the form adds the ones the user accepts. */
export async function generateAutoTags(input: AutoTagsInput): Promise<AiResult<string[]>> {
  const e = await getErrors();
  const parsed = autoTagsSchema.safeParse(input);
  if (!parsed.success) return failure(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return failure(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return failure(blocked.error);

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
    if (blocked) return failure(blocked.error);

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

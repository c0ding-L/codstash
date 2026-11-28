"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { errKey, type ErrorKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { fail, type ActionResult } from "@/lib/action-result";
import { AiProviderError, aiErrorMessage, complete, type AiMessage } from "@/lib/ai-client";
import { aiGate, answerLocale } from "@/lib/ai-gate";
import { parseDescription, parseTagSuggestions } from "@/lib/ai-output";
import { DESCRIPTION_MAX_TOKENS, TAG_MAX_TOKENS, descriptionMessages, tagSuggestionMessages } from "@/lib/ai-prompts";
import { ITEM_LIMITS } from "@/lib/item-limits";

export type AiResult<T> = ActionResult<T>;

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

interface CompletionOptions<S extends z.ZodType, T> {
  schema: S;
  /** The action's name, for the logs. */
  name: string;
  messages: (data: z.infer<S>) => AiMessage[] | Promise<AiMessage[]>;
  maxTokens: number;
  /** The answer as the action returns it, or null when there is nothing usable in it. */
  parse: (answer: string, data: z.infer<S>) => T | null;
  /** When `parse` found nothing. */
  empty: ErrorKey;
  failed: ErrorKey;
}

/** Validates the input, checks the AI gate and asks the model once. Nothing is saved. */
async function runCompletion<S extends z.ZodType, T>(
  input: unknown,
  { schema, name, messages, maxTokens, parse, empty, failed }: CompletionOptions<S, T>,
): Promise<AiResult<T>> {
  const e = await getErrors();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(e.issue(parsed.error.issues[0]));

  try {
    const session = await auth();
    if (!session?.user?.id) return fail(e.message("notSignedIn"));

    const blocked = await aiGate(session.user.id, e);
    if (blocked) return fail(blocked.error);

    let answer: string;
    try {
      answer = await complete(await messages(parsed.data), { maxTokens });
    } catch (error) {
      // The client logs the provider's own errors; a missing key or unknown provider is logged here.
      if (!(error instanceof AiProviderError)) {
        console.error(`[ai] ${name} could not call the AI:`, error);
      }
      return fail(await aiErrorMessage(error));
    }

    const result = parse(answer, parsed.data);
    if (result === null) return fail(e.message(empty));
    return { success: true, data: result, error: null };
  } catch (error) {
    console.error(`[ai] ${name} failed:`, error);
    return fail(e.message(failed));
  }
}

/** 3-5 new tags for the item in the form. Nothing is saved: the form adds the ones the user accepts. */
export async function generateAutoTags(input: AutoTagsInput): Promise<AiResult<string[]>> {
  return runCompletion(input, {
    schema: autoTagsSchema,
    name: "generateAutoTags",
    messages: tagSuggestionMessages,
    maxTokens: TAG_MAX_TOKENS,
    parse: (answer, data) => {
      const tags = parseTagSuggestions(answer, data.tags);
      return tags.length > 0 ? tags : null;
    },
    empty: "ai.noTags",
    failed: "ai.tagsFailed",
  });
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
  return runCompletion(input, {
    schema: descriptionSchema,
    name: "generateDescription",
    messages: async (data) => descriptionMessages({ ...data, locale: await answerLocale() }),
    maxTokens: DESCRIPTION_MAX_TOKENS,
    parse: (answer) => parseDescription(answer) || null,
    empty: "ai.noDescription",
    failed: "ai.descriptionFailed",
  });
}

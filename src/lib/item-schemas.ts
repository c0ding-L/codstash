import { z } from "zod";

import { errKey, type ErrorKey } from "@/i18n/error-keys";
import { ITEM_LIMITS } from "@/lib/item-limits";

/*
 * The item schemas, out of `src/actions/items.ts`: a "use server" file can export only async
 * functions, and import (A4) and the REST API (C2) validate with the same rules.
 */

/** An input left blank clears the field, so it is stored as null rather than "". */
function blankToNull(value: unknown) {
  if (typeof value !== "string") return value;
  return value.trim() || null;
}

/** Like `blankToNull`, but keeps the text as typed: indentation and newlines are code. */
function blankToNullUntrimmed(value: unknown) {
  if (typeof value !== "string") return value;
  return value.trim() ? value : null;
}

/** `tooLong` is a whole sentence per field: French agrees it with the field's gender. */
function optionalText(max: number, tooLong: ErrorKey) {
  return z.preprocess(blankToNull, z.string().max(max, tooLong).nullable().optional());
}

export const updateItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, errKey("items.titleRequired"))
    .max(ITEM_LIMITS.title, errKey("items.titleTooLong")),
  description: optionalText(ITEM_LIMITS.description, "items.descriptionTooLong"),
  content: z.preprocess(
    blankToNullUntrimmed,
    z
      .string()
      .max(ITEM_LIMITS.content, errKey("items.contentTooLong"))
      .nullable()
      .optional(),
  ),
  language: optionalText(ITEM_LIMITS.language, "items.languageTooLong"),
  url: z.preprocess(blankToNull, z.url(errKey("items.invalidUrl")).nullable().optional()),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, errKey("items.tagEmpty"))
        .max(ITEM_LIMITS.tag, errKey("items.tagTooLong")),
    )
    .max(ITEM_LIMITS.tags, errKey("items.tooManyTags")),
  collectionIds: z
    .array(z.string().min(1, errKey("items.collectionInvalid")))
    .max(ITEM_LIMITS.collections, errKey("items.tooManyCollections"))
    // Deduplicated here, so the cap and the ownership check count each one once.
    .transform((ids) => [...new Set(ids)]),
});

const baseFields = {
  title: updateItemSchema.shape.title,
  description: updateItemSchema.shape.description,
  tags: updateItemSchema.shape.tags,
  collectionIds: updateItemSchema.shape.collectionIds,
};
const contentField = updateItemSchema.shape.content;
const languageField = updateItemSchema.shape.language;
const fileKeyField = z.string({ error: errKey("items.chooseFile") }).min(1, errKey("items.chooseFile"));

/**
 * One shape per type, so a field the type does not use is stripped rather than
 * stored, and a type outside the list is refused. A custom type comes as
 * `type: "custom"` with its id, never as a slug.
 */
export const createItemSchema = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("snippet"), ...baseFields, content: contentField, language: languageField }),
    z.object({ type: z.literal("command"), ...baseFields, content: contentField, language: languageField }),
    z.object({ type: z.literal("prompt"), ...baseFields, content: contentField }),
    z.object({ type: z.literal("note"), ...baseFields, content: contentField }),
    z.object({
      type: z.literal("link"),
      ...baseFields,
      // Blank becomes null, which fails as "required" rather than as a bad URL.
      url: z.preprocess(
        blankToNull,
        z.url({ error: (issue) => (issue.input == null ? errKey("items.urlRequired") : errKey("items.invalidUrl")) }),
      ),
    }),
    z.object({ type: z.literal("file"), ...baseFields, fileKey: fileKeyField }),
    z.object({ type: z.literal("image"), ...baseFields, fileKey: fileKeyField }),
    // One of the user's own types: a note's fields plus a language. The action checks the id.
    z.object({
      type: z.literal("custom"),
      typeId: z.string({ error: errKey("items.chooseType") }).trim().min(1, errKey("items.chooseType")).max(100, errKey("items.chooseType")),
      ...baseFields,
      content: contentField,
      language: languageField,
    }),
  ],
  { error: errKey("items.chooseType") },
);

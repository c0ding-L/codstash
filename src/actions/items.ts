"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { ownsCollections } from "@/lib/db/collections";
import { fromObjectMetadata, isOwnKey } from "@/lib/files";
import { deleteObjectsQuietly, headObject } from "@/lib/r2";
import {
  createItem as createItemQuery,
  deleteItem as deleteItemQuery,
  isFileKeyInUse,
  setItemFavorite as setItemFavoriteQuery,
  setItemPinned as setItemPinnedQuery,
  updateItem as updateItemQuery,
  type DashboardItem,
  type ItemDetailJson,
} from "@/lib/db/items";

/** What the drawer sends. A field the item's type does not use is left out, not null. */
export interface UpdateItemInput {
  title: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  tags: string[];
  /** Replaces every collection the item is in; empty takes it out of all of them. */
  collectionIds: string[];
}

export type UpdateItemField = keyof UpdateItemInput;

export type UpdateItemResult =
  | { success: true; data: { card: DashboardItem; detail: ItemDetailJson }; error: null }
  /** `field` names the input at fault when validation failed, so the form can mark it. */
  | { success: false; data: null; error: string; field?: UpdateItemField };

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

/**
 * Caps on what one item can hold. Without them only the 1 MB action body limits a
 * field, and every tag is its own upsert in the same write.
 */
const ITEM_LIMITS = {
  title: 200,
  description: 2_000,
  content: 100_000,
  language: 50,
  tag: 50,
  tags: 20,
  collections: 20,
} as const;

function optionalText(max: number, label: string) {
  return z.preprocess(
    blankToNull,
    z.string().max(max, `${label} can be at most ${max.toLocaleString("en-US")} characters.`).nullable().optional(),
  );
}

const updateItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(ITEM_LIMITS.title, `Title can be at most ${ITEM_LIMITS.title} characters.`),
  description: optionalText(ITEM_LIMITS.description, "Description"),
  content: z.preprocess(
    blankToNullUntrimmed,
    z
      .string()
      .max(ITEM_LIMITS.content, `Content can be at most ${ITEM_LIMITS.content.toLocaleString("en-US")} characters.`)
      .nullable()
      .optional(),
  ),
  language: optionalText(ITEM_LIMITS.language, "Language"),
  url: z.preprocess(blankToNull, z.url("Enter a valid URL.").nullable().optional()),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tags cannot be empty.")
        .max(ITEM_LIMITS.tag, `Each tag can be at most ${ITEM_LIMITS.tag} characters.`),
    )
    .max(ITEM_LIMITS.tags, `An item can have at most ${ITEM_LIMITS.tags} tags.`),
  collectionIds: z
    .array(z.string().min(1, "Choose a collection from the list."))
    .max(ITEM_LIMITS.collections, `An item can be in at most ${ITEM_LIMITS.collections} collections.`)
    // Deduplicated here, so the cap and the ownership check count each one once.
    .transform((ids) => [...new Set(ids)]),
});

const UNKNOWN_COLLECTION = "One of the chosen collections no longer exists. Choose again.";

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function updateItem(itemId: string, input: UpdateItemInput): Promise<UpdateItemResult> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: issue?.message ?? "Invalid input.",
      ...(typeof field === "string" && field in updateItemSchema.shape && { field: field as UpdateItemField }),
    };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    // `connect` does not filter on the owner, so the ids are checked here.
    if (!(await ownsCollections(session.user.id, parsed.data.collectionIds))) {
      return { success: false, data: null, error: UNKNOWN_COLLECTION, field: "collectionIds" };
    }

    // The query filters on the owner, so another user's item is not found either.
    const { card, detail } = await updateItemQuery(session.user.id, itemId, parsed.data);
    return {
      success: true,
      data: { card, detail: { ...detail, createdAt: detail.createdAt.toISOString() } },
      error: null,
    };
  } catch (error) {
    if (isNotFound(error)) return { success: false, data: null, error: "This item no longer exists." };
    console.error("[items] updateItem failed:", error);
    return { success: false, data: null, error: "Could not save the item. Try again." };
  }
}

/** The types an item can be created as from the dialog. */
export type CreatableType = "snippet" | "prompt" | "command" | "note" | "link" | "file" | "image";

/** What the dialog sends: the type, plus only the fields that type uses. */
export interface CreateItemInput {
  type: CreatableType;
  title: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  /** File and image items: the key `/api/upload` returned for the uploaded file. */
  fileKey?: string;
  tags: string[];
  /** The collections to add it to; empty for none. */
  collectionIds: string[];
}

export type CreateItemField = keyof CreateItemInput;

const CREATE_ITEM_FIELDS: ReadonlySet<string> = new Set<CreateItemField>([
  "type",
  "title",
  "description",
  "content",
  "url",
  "language",
  "fileKey",
  "tags",
  "collectionIds",
]);

export type CreateItemResult =
  | { success: true; data: DashboardItem; error: null }
  /** `field` names the input at fault when validation failed, so the form can mark it. */
  | { success: false; data: null; error: string; field?: CreateItemField };

const baseFields = {
  title: updateItemSchema.shape.title,
  description: updateItemSchema.shape.description,
  tags: updateItemSchema.shape.tags,
  collectionIds: updateItemSchema.shape.collectionIds,
};
const contentField = updateItemSchema.shape.content;
const languageField = updateItemSchema.shape.language;
const fileKeyField = z.string({ error: "Choose a file to upload." }).min(1, "Choose a file to upload.");

const UPLOAD_NOT_FOUND = "The uploaded file was not found. Upload it again.";

/**
 * One shape per type, so a field the type does not use is stripped rather than
 * stored, and a type outside the list (a custom one) is refused.
 */
const createItemSchema = z.discriminatedUnion(
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
      url: z.preprocess(blankToNull, z.url({ error: (issue) => (issue.input == null ? "URL is required." : "Enter a valid URL.") })),
    }),
    z.object({ type: z.literal("file"), ...baseFields, fileKey: fileKeyField }),
    z.object({ type: z.literal("image"), ...baseFields, fileKey: fileKeyField }),
  ],
  { error: "Choose a type." },
);

export async function createItem(input: CreateItemInput): Promise<CreateItemResult> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: issue?.message ?? "Invalid input.",
      ...(typeof field === "string" && CREATE_ITEM_FIELDS.has(field) && { field: field as CreateItemField }),
    };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    const userId = session.user.id;

    // `connect` does not filter on the owner, so the ids are checked here.
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      // The form uploads again on the next try, so this upload would point nowhere.
      if ("fileKey" in parsed.data) {
        const { fileKey } = parsed.data;
        if (isOwnKey(userId, fileKey) && !(await isFileKeyInUse(userId, fileKey))) await deleteObjectsQuietly([fileKey]);
      }
      return { success: false, data: null, error: UNKNOWN_COLLECTION, field: "collectionIds" };
    }

    if (parsed.data.type !== "file" && parsed.data.type !== "image") {
      const card = await createItemQuery(userId, parsed.data);
      return { success: true, data: card, error: null };
    }

    // The key comes back from the browser, so it is checked rather than trusted: it
    // must be this user's, exist in R2 and have been uploaded as this kind. The name
    // and size are read from R2, not from the browser.
    const { fileKey, ...fields } = parsed.data;
    const head = isOwnKey(userId, fileKey) ? await headObject(fileKey) : null;
    const stored = fromObjectMetadata(head?.metadata);
    if (!head || stored?.kind !== fields.type) {
      // Uploaded as the other kind: nothing will point at it, unless the key is an
      // existing item's, sent again. Only an unused object is removed.
      if (head && !(await isFileKeyInUse(userId, fileKey))) await deleteObjectsQuietly([fileKey]);
      return { success: false, data: null, error: UPLOAD_NOT_FOUND, field: "fileKey" };
    }

    try {
      const card = await createItemQuery(userId, {
        ...fields,
        contentType: "file",
        fileUrl: fileKey,
        fileName: stored.fileName,
        fileSize: head.size,
      });
      return { success: true, data: card, error: null };
    } catch (error) {
      // Nothing points at the upload any more.
      await deleteObjectsQuietly([fileKey]);
      throw error;
    }
  } catch (error) {
    console.error("[items] createItem failed:", error);
    return { success: false, data: null, error: "Could not create the item. Try again." };
  }
}

export type DeleteItemResult = { success: true; data: null; error: null } | { success: false; data: null; error: string };

export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    // The query filters on the owner, so another user's item is not found either.
    const { fileUrl } = await deleteItemQuery(session.user.id, itemId);
    // After the row is gone: a failure here leaves an orphaned object, not a broken item.
    if (fileUrl) await deleteObjectsQuietly([fileUrl]);
    return { success: true, data: null, error: null };
  } catch (error) {
    if (isNotFound(error)) return { success: false, data: null, error: "This item no longer exists." };
    console.error("[items] deleteItem failed:", error);
    return { success: false, data: null, error: "Could not delete the item. Try again." };
  }
}

export type SetFavoriteResult =
  | { success: true; data: { isFavorite: boolean }; error: null }
  | { success: false; data: null; error: string };

/** Takes the state to set, not a flip, so a repeated click cannot leave the row out of step. */
export async function setItemFavorite(itemId: string, isFavorite: boolean): Promise<SetFavoriteResult> {
  if (typeof isFavorite !== "boolean") return { success: false, data: null, error: "Invalid favorite value." };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    // The query filters on the owner, so another user's item is not found either.
    const found = await setItemFavoriteQuery(session.user.id, itemId, isFavorite);
    if (!found) return { success: false, data: null, error: "This item no longer exists." };
  } catch (error) {
    console.error("[items] setItemFavorite failed:", error);
    return { success: false, data: null, error: "Could not update the favorite. Try again." };
  }

  // The layout too: the sidebar, stats and top bar count favorites.
  revalidatePath("/", "layout");
  return { success: true, data: { isFavorite }, error: null };
}

export type SetPinnedResult =
  | { success: true; data: { isPinned: boolean }; error: null }
  | { success: false; data: null; error: string };

/** Like `setItemFavorite`: takes the state to set, not a flip. */
export async function setItemPinned(itemId: string, isPinned: boolean): Promise<SetPinnedResult> {
  if (typeof isPinned !== "boolean") return { success: false, data: null, error: "Invalid pin value." };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    // The query filters on the owner, so another user's item is not found either.
    const found = await setItemPinnedQuery(session.user.id, itemId, isPinned);
    if (!found) return { success: false, data: null, error: "This item no longer exists." };
  } catch (error) {
    console.error("[items] setItemPinned failed:", error);
    return { success: false, data: null, error: "Could not update the pin. Try again." };
  }

  // The layout too: the dashboard's Pinned section and every list's order change.
  revalidatePath("/", "layout");
  return { success: true, data: { isPinned }, error: null };
}

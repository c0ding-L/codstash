"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { invalidInput, type ActionResult } from "@/lib/action-result";
import { getPlanStatus } from "@/lib/db/billing";
import { ownsCollections } from "@/lib/db/collections";
import { ownsCustomType } from "@/lib/db/item-types";
import { fromObjectMetadata, isOwnKey } from "@/lib/files";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { isPrismaNotFound } from "@/lib/prisma-errors";
import { setFlagAction } from "@/lib/set-flag-action";
import { createItemSchema, updateItemSchema } from "@/lib/item-schemas";
import { deleteObjectsQuietly, headObject } from "@/lib/r2";
import { FREE_LIMITS, LimitReachedError, canCreateItem, canUploadFiles, canUseCustomTypes } from "@/lib/usage-limits";
import {
  createItem as createItemQuery,
  deleteItem as deleteItemQuery,
  isFileKeyInUse,
  setItemFavorite as setItemFavoriteQuery,
  setItemPinned as setItemPinnedQuery,
  updateItem as updateItemQuery,
  updatePromptContent,
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

export type UpdateItemResult = ActionResult<{ card: DashboardItem; detail: ItemDetailJson }, UpdateItemField>;

const UPDATE_ITEM_FIELDS: ReadonlySet<string> = new Set(Object.keys(updateItemSchema.shape));

export async function updateItem(itemId: string, input: UpdateItemInput): Promise<UpdateItemResult> {
  const e = await getErrors();
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return invalidInput<UpdateItemField>(e, parsed.error, UPDATE_ITEM_FIELDS);

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // `connect` does not filter on the owner, so the ids are checked here.
    if (!(await ownsCollections(session.user.id, parsed.data.collectionIds))) {
      return { success: false, data: null, error: e.message("items.unknownCollection"), field: "collectionIds" };
    }

    // The query filters on the owner, so another user's item is not found either.
    const { card, detail } = await updateItemQuery(session.user.id, itemId, parsed.data);
    return {
      success: true,
      data: { card, detail: { ...detail, createdAt: detail.createdAt.toISOString() } },
      error: null,
    };
  } catch (error) {
    if (isPrismaNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
    console.error("[items] updateItem failed:", error);
    return { success: false, data: null, error: e.message("items.saveFailed") };
  }
}

const applyOptimizedPromptSchema = z.object({
  itemId: z.string().trim().min(1, errKey("items.itemNotFound")).max(100, errKey("items.itemNotFound")),
  content: z
    .string()
    .trim()
    .min(1, errKey("items.optimizedEmpty"))
    .max(ITEM_LIMITS.content, errKey("items.contentTooLong")),
});

/**
 * Saves an AI-optimized prompt the user accepted in the drawer: only the content changes, and only
 * on the user's own prompt. Returns the saved item, like `updateItem`, so the drawer shows it.
 */
export async function applyOptimizedPrompt(input: { itemId: string; content: string }): Promise<UpdateItemResult> {
  const e = await getErrors();
  const parsed = applyOptimizedPromptSchema.safeParse(input);
  if (!parsed.success) return { success: false, data: null, error: e.issue(parsed.error.issues[0]) };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner and the prompt type, so anything else is not found.
    const { card, detail } = await updatePromptContent(session.user.id, parsed.data.itemId, parsed.data.content);
    return {
      success: true,
      data: { card, detail: { ...detail, createdAt: detail.createdAt.toISOString() } },
      error: null,
    };
  } catch (error) {
    if (isPrismaNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
    console.error("[items] applyOptimizedPrompt failed:", error);
    return { success: false, data: null, error: e.message("items.promptSaveFailed") };
  }
}

/** The types an item can be created as from the dialog. */
export type CreatableType = "snippet" | "prompt" | "command" | "note" | "link" | "file" | "image";

/** What the dialog sends: the type, plus only the fields that type uses. */
export interface CreateItemInput {
  /** `"custom"` with `typeId` for one of the user's own types. */
  type: CreatableType | "custom";
  /** Custom types only: the id of one of the user's own types. */
  typeId?: string;
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
  "typeId",
  "title",
  "description",
  "content",
  "url",
  "language",
  "fileKey",
  "tags",
  "collectionIds",
]);

export type CreateItemResult = ActionResult<DashboardItem, CreateItemField>;

export async function createItem(input: CreateItemInput): Promise<CreateItemResult> {
  const e = await getErrors();
  // A discriminated union has no `.shape`, so its fields are listed above.
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) return invalidInput<CreateItemField>(e, parsed.error, CREATE_ITEM_FIELDS);

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    const userId = session.user.id;

    // A refused create leaves the upload pointing nowhere (the form uploads again
    // on the next try), so an unused object of this user's is removed.
    const discardUpload = async () => {
      if (!("fileKey" in parsed.data)) return;
      const { fileKey } = parsed.data;
      if (isOwnKey(userId, fileKey) && !(await isFileKeyInUse(userId, fileKey))) await deleteObjectsQuietly([fileKey]);
    };

    // Read now, not from the session: the token can be a request old.
    const plan = await getPlanStatus(userId);
    const isUpload = parsed.data.type === "file" || parsed.data.type === "image";
    if (isUpload && !canUploadFiles(plan)) {
      await discardUpload();
      return { success: false, data: null, error: e.message("limits.uploads") };
    }
    if (parsed.data.type === "custom" && !canUseCustomTypes(plan)) {
      return { success: false, data: null, error: e.message("limits.customTypes") };
    }
    if (!canCreateItem(plan)) {
      await discardUpload();
      return { success: false, data: null, error: e.message("limits.items", { max: FREE_LIMITS.items }) };
    }
    // Re-checked under a lock in the insert, so parallel requests cannot all pass the count above.
    const limits = { maxItems: plan.isPro ? undefined : FREE_LIMITS.items };

    // `connect` does not filter on the owner, so the ids are checked here.
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      await discardUpload();
      return { success: false, data: null, error: e.message("items.unknownCollection"), field: "collectionIds" };
    }

    if (parsed.data.type === "custom") {
      // Only the user's own custom types: a system type's id or another user's is refused.
      const { typeId, title, description, content, language, tags, collectionIds } = parsed.data;
      const fields = { title, description, content, language, tags, collectionIds };
      if (!(await ownsCustomType(userId, typeId))) {
        return { success: false, data: null, error: e.message("items.unknownType"), field: "typeId" };
      }
      const card = await createItemQuery(userId, { ...fields, type: { customTypeId: typeId } }, limits);
      return { success: true, data: card, error: null };
    }

    if (parsed.data.type !== "file" && parsed.data.type !== "image") {
      const card = await createItemQuery(userId, parsed.data, limits);
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
      return { success: false, data: null, error: e.message("items.uploadNotFound"), field: "fileKey" };
    }

    try {
      const card = await createItemQuery(
        userId,
        { ...fields, contentType: "file", fileUrl: fileKey, fileName: stored.fileName, fileSize: head.size },
        limits,
      );
      return { success: true, data: card, error: null };
    } catch (error) {
      // Nothing points at the upload any more.
      await deleteObjectsQuietly([fileKey]);
      throw error;
    }
  } catch (error) {
    // Lost the race for the last Free slot; an upload was already removed above.
    if (error instanceof LimitReachedError) return { success: false, data: null, error: e.message("limits.items", { max: FREE_LIMITS.items }) };
    console.error("[items] createItem failed:", error);
    return { success: false, data: null, error: e.message("items.createFailed") };
  }
}

export type DeleteItemResult = ActionResult;

export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const e = await getErrors();
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner, so another user's item is not found either.
    const { fileUrl } = await deleteItemQuery(session.user.id, itemId);
    // After the row is gone: a failure here leaves an orphaned object, not a broken item.
    if (fileUrl) await deleteObjectsQuietly([fileUrl]);
    return { success: true, data: null, error: null };
  } catch (error) {
    if (isPrismaNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
    console.error("[items] deleteItem failed:", error);
    return { success: false, data: null, error: e.message("items.deleteFailed") };
  }
}

export type SetFavoriteResult = ActionResult<{ isFavorite: boolean }>;

/** Takes the state to set, not a flip, so a repeated click cannot leave the row out of step. */
export async function setItemFavorite(itemId: string, isFavorite: boolean): Promise<SetFavoriteResult> {
  // The query filters on the owner, so another user's item is not found either.
  return setFlagAction({
    key: "isFavorite",
    value: isFavorite,
    invalid: "items.invalidFavorite",
    notFound: "items.notFound",
    failed: "items.favoriteFailed",
    log: "[items] setItemFavorite",
    write: (userId, value) => setItemFavoriteQuery(userId, itemId, value),
  });
}

export type SetPinnedResult = ActionResult<{ isPinned: boolean }>;

/** Like `setItemFavorite`: takes the state to set, not a flip. */
export async function setItemPinned(itemId: string, isPinned: boolean): Promise<SetPinnedResult> {
  return setFlagAction({
    key: "isPinned",
    value: isPinned,
    invalid: "items.invalidPin",
    notFound: "items.notFound",
    failed: "items.pinFailed",
    log: "[items] setItemPinned",
    write: (userId, value) => setItemPinnedQuery(userId, itemId, value),
  });
}

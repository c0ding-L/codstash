"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { ownsCollections } from "@/lib/db/collections";
import { fromObjectMetadata, isOwnKey } from "@/lib/files";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { createItemSchema, updateItemSchema } from "@/lib/item-schemas";
import { deleteObjectsQuietly, headObject } from "@/lib/r2";
import { FREE_LIMITS, LimitReachedError, canCreateItem, canUploadFiles } from "@/lib/usage-limits";
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

export type UpdateItemResult =
  | { success: true; data: { card: DashboardItem; detail: ItemDetailJson }; error: null }
  /** `field` names the input at fault when validation failed, so the form can mark it. */
  | { success: false; data: null; error: string; field?: UpdateItemField };

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function updateItem(itemId: string, input: UpdateItemInput): Promise<UpdateItemResult> {
  const e = await getErrors();
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: e.issue(issue),
      ...(typeof field === "string" && field in updateItemSchema.shape && { field: field as UpdateItemField }),
    };
  }

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
    if (isNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
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
    if (isNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
    console.error("[items] applyOptimizedPrompt failed:", error);
    return { success: false, data: null, error: e.message("items.promptSaveFailed") };
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

export async function createItem(input: CreateItemInput): Promise<CreateItemResult> {
  const e = await getErrors();
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: e.issue(issue),
      ...(typeof field === "string" && CREATE_ITEM_FIELDS.has(field) && { field: field as CreateItemField }),
    };
  }

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

export type DeleteItemResult = { success: true; data: null; error: null } | { success: false; data: null; error: string };

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
    if (isNotFound(error)) return { success: false, data: null, error: e.message("items.notFound") };
    console.error("[items] deleteItem failed:", error);
    return { success: false, data: null, error: e.message("items.deleteFailed") };
  }
}

export type SetFavoriteResult =
  | { success: true; data: { isFavorite: boolean }; error: null }
  | { success: false; data: null; error: string };

/** Takes the state to set, not a flip, so a repeated click cannot leave the row out of step. */
export async function setItemFavorite(itemId: string, isFavorite: boolean): Promise<SetFavoriteResult> {
  const e = await getErrors();
  if (typeof isFavorite !== "boolean") return { success: false, data: null, error: e.message("items.invalidFavorite") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner, so another user's item is not found either.
    const found = await setItemFavoriteQuery(session.user.id, itemId, isFavorite);
    if (!found) return { success: false, data: null, error: e.message("items.notFound") };
  } catch (error) {
    console.error("[items] setItemFavorite failed:", error);
    return { success: false, data: null, error: e.message("items.favoriteFailed") };
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
  const e = await getErrors();
  if (typeof isPinned !== "boolean") return { success: false, data: null, error: e.message("items.invalidPin") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner, so another user's item is not found either.
    const found = await setItemPinnedQuery(session.user.id, itemId, isPinned);
    if (!found) return { success: false, data: null, error: e.message("items.notFound") };
  } catch (error) {
    console.error("[items] setItemPinned failed:", error);
    return { success: false, data: null, error: e.message("items.pinFailed") };
  }

  // The layout too: the dashboard's Pinned section and every list's order change.
  revalidatePath("/", "layout");
  return { success: true, data: { isPinned }, error: null };
}

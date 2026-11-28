"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getErrors, type Errors } from "@/i18n/errors-server";
import { invalidInput, type ActionResult } from "@/lib/action-result";
import { getPlanStatus } from "@/lib/db/billing";
import {
  MAX_CUSTOM_TYPES,
  createCustomType,
  deleteCustomType as deleteCustomTypeQuery,
  isCustomTypeNameTaken,
  updateCustomType,
} from "@/lib/db/item-types";
import { isReservedTypeSlug, slugify } from "@/lib/item-type-ui";
import { itemTypeSchema } from "@/lib/item-type-schema";
import { prismaErrorCode } from "@/lib/prisma-errors";
import { LimitReachedError, canUseCustomTypes } from "@/lib/usage-limits";

/** What the type dialog sends. */
export interface ItemTypeInput {
  name: string;
  icon: string;
  color: string;
  template?: string | null;
}

export type ItemTypeField = keyof ItemTypeInput;

export type ItemTypeResult = ActionResult<{ id: string; slug: string }, ItemTypeField>;

export type DeleteItemTypeResult = ActionResult;

const ITEM_TYPE_FIELDS: ReadonlySet<string> = new Set(Object.keys(itemTypeSchema.shape));
type Parsed = z.infer<typeof itemTypeSchema>;

/** Validates the input and derives the slug; a failure names the field at fault. */
function parseInput(e: Errors, input: ItemTypeInput): { data: Parsed & { slug: string } } | { failure: ItemTypeResult } {
  const parsed = itemTypeSchema.safeParse(input);
  if (!parsed.success) return { failure: invalidInput<ItemTypeField>(e, parsed.error, ITEM_TYPE_FIELDS) };
  const slug = slugify(parsed.data.name);
  if (!slug) return { failure: { success: false, data: null, error: e.message("itemTypes.nameNoSlug"), field: "name" } };
  if (isReservedTypeSlug(slug)) {
    return { failure: { success: false, data: null, error: e.message("itemTypes.nameReserved"), field: "name" } };
  }
  return { data: { ...parsed.data, slug } };
}

/** Signed in and Pro, read now rather than from the session: the token can be a request old. */
async function proUserId(e: Errors): Promise<{ userId: string } | { failure: ItemTypeResult }> {
  const session = await auth();
  if (!session?.user?.id) return { failure: { success: false, data: null, error: e.message("notSignedIn") } };
  if (!canUseCustomTypes(await getPlanStatus(session.user.id))) {
    return { failure: { success: false, data: null, error: e.message("limits.customTypes") } };
  }
  return { userId: session.user.id };
}

async function save(input: ItemTypeInput, id: string | null): Promise<ItemTypeResult> {
  const e = await getErrors();
  const parsed = parseInput(e, input);
  if ("failure" in parsed) return parsed.failure;
  const { name, slug, icon, color, template } = parsed.data;

  try {
    const user = await proUserId(e);
    if ("failure" in user) return user.failure;

    // Names are unique per user ignoring case; two names with one slug ("C#", "C++") are
    // caught by the `[userId, slug]` unique below.
    if (await isCustomTypeNameTaken(user.userId, name, id ?? undefined)) {
      return { success: false, data: null, error: e.message("itemTypes.nameTaken"), field: "name" };
    }

    const data = { name, slug, icon, color, template: template ?? null };
    const saved = id === null ? await createCustomType(user.userId, data) : await updateCustomType(user.userId, id, data);

    // The sidebar, the top bar's dialog and the type pages list the types.
    revalidatePath("/", "layout");
    return { success: true, data: saved, error: null };
  } catch (error) {
    if (error instanceof LimitReachedError) {
      return { success: false, data: null, error: e.message("itemTypes.tooMany", { max: MAX_CUSTOM_TYPES }) };
    }
    if (prismaErrorCode(error) === "P2002") {
      return { success: false, data: null, error: e.message("itemTypes.nameTaken"), field: "name" };
    }
    if (prismaErrorCode(error) === "P2025") return { success: false, data: null, error: e.message("itemTypes.notFound") };
    console.error(`[item-types] ${id === null ? "create" : "update"} failed:`, error);
    return { success: false, data: null, error: e.message("itemTypes.saveFailed") };
  }
}

/** Creates one of the user's own item types. Pro only, at most `MAX_CUSTOM_TYPES`. */
export async function createItemType(input: ItemTypeInput): Promise<ItemTypeResult> {
  return save(input, null);
}

/** Edits one of the user's own item types. Pro only; renaming changes the slug, so its URL. */
export async function updateItemType(id: string, input: ItemTypeInput): Promise<ItemTypeResult> {
  if (typeof id !== "string" || !id) {
    const e = await getErrors();
    return { success: false, data: null, error: e.message("itemTypes.notFound") };
  }
  return save(input, id);
}

/**
 * Deletes one of the user's own item types, once no item uses it. Not gated on Pro: after a
 * lapse, the user can still tidy up. Another user's type, or a system one, is not found.
 */
export async function deleteItemType(id: string): Promise<DeleteItemTypeResult> {
  const e = await getErrors();
  if (typeof id !== "string" || !id) return { success: false, data: null, error: e.message("itemTypes.notFound") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    const result = await deleteCustomTypeQuery(session.user.id, id);
    if (result === null) return { success: false, data: null, error: e.message("itemTypes.notFound") };
    if (!result.deleted) {
      return { success: false, data: null, error: e.message("itemTypes.inUse", { count: result.itemCount }) };
    }
  } catch (error) {
    // An item was added meanwhile: `onDelete: Restrict` refused the delete.
    if (prismaErrorCode(error) === "P2003") return { success: false, data: null, error: e.message("itemTypes.inUseNow") };
    if (prismaErrorCode(error) === "P2025") return { success: false, data: null, error: e.message("itemTypes.notFound") };
    console.error("[item-types] delete failed:", error);
    return { success: false, data: null, error: e.message("itemTypes.deleteFailed") };
  }

  revalidatePath("/", "layout");
  return { success: true, data: null, error: null };
}

"use server";

import { z } from "zod";

import { auth } from "@/auth";
import {
  deleteItem as deleteItemQuery,
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

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

const updateItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: optionalText,
  content: z.preprocess(blankToNullUntrimmed, z.string().nullable().optional()),
  language: optionalText,
  url: z.preprocess(blankToNull, z.url("Enter a valid URL.").nullable().optional()),
  tags: z.array(z.string().trim().min(1, "Tags cannot be empty.")),
});

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

export type DeleteItemResult = { success: true; data: null; error: null } | { success: false; data: null; error: string };

export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    // The query filters on the owner, so another user's item is not found either.
    await deleteItemQuery(session.user.id, itemId);
    return { success: true, data: null, error: null };
  } catch (error) {
    if (isNotFound(error)) return { success: false, data: null, error: "This item no longer exists." };
    console.error("[items] deleteItem failed:", error);
    return { success: false, data: null, error: "Could not delete the item. Try again." };
  }
}

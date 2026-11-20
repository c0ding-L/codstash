"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { createCollection as createCollectionQuery, type RecentCollection } from "@/lib/db/collections";

/** An input left blank is stored as null rather than "". */
function blankToNull(value: unknown) {
  if (typeof value !== "string") return value;
  return value.trim() || null;
}

/** Caps on what one collection can hold, in line with the item caps. */
const COLLECTION_LIMITS = {
  name: 100,
  description: 2_000,
} as const;

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
}

export type CreateCollectionField = keyof CreateCollectionInput;

const CREATE_COLLECTION_FIELDS: ReadonlySet<string> = new Set<CreateCollectionField>(["name", "description"]);

export type CreateCollectionResult =
  | { success: true; data: RecentCollection; error: null }
  /** `field` names the input at fault when validation failed, so the form can mark it. */
  | { success: false; data: null; error: string; field?: CreateCollectionField };

const createCollectionSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(1, "Name is required.")
    .max(COLLECTION_LIMITS.name, `Name can be at most ${COLLECTION_LIMITS.name} characters.`),
  description: z.preprocess(
    blankToNull,
    z
      .string()
      .max(
        COLLECTION_LIMITS.description,
        `Description can be at most ${COLLECTION_LIMITS.description.toLocaleString("en-US")} characters.`,
      )
      .nullable()
      .optional(),
  ),
});

export async function createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      success: false,
      data: null,
      error: issue?.message ?? "Invalid input.",
      ...(typeof field === "string" &&
        CREATE_COLLECTION_FIELDS.has(field) && { field: field as CreateCollectionField }),
    };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: "You are not signed in." };

    const collection = await createCollectionQuery(session.user.id, parsed.data);
    return { success: true, data: collection, error: null };
  } catch (error) {
    console.error("[collections] createCollection failed:", error);
    return { success: false, data: null, error: "Could not create the collection. Try again." };
  }
}

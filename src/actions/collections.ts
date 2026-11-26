"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import {
  createCollection as createCollectionQuery,
  deleteCollection as deleteCollectionQuery,
  setCollectionFavorite as setCollectionFavoriteQuery,
  updateCollection as updateCollectionQuery,
  type CollectionSummary,
  type RecentCollection,
} from "@/lib/db/collections";
import { FREE_LIMITS, LimitReachedError, canCreateCollection } from "@/lib/usage-limits";

/** An input left blank is stored as null rather than "". */
function blankToNull(value: unknown) {
  if (typeof value !== "string") return value;
  return value.trim() || null;
}

/** Caps on what one collection can hold, in line with the item caps. */
const COLLECTION_LIMITS = {
  name: 100,
  description: 10_000,
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

/** Shared by create and update: the same name and description rules. */
const collectionSchema = z.object({
  name: z
    .string({ error: errKey("collections.nameRequired") })
    .trim()
    .min(1, errKey("collections.nameRequired"))
    .max(COLLECTION_LIMITS.name, errKey("collections.nameTooLong")),
  description: z.preprocess(
    blankToNull,
    z
      .string()
      .max(COLLECTION_LIMITS.description, errKey("collections.descriptionTooLong"))
      .nullable()
      .optional(),
  ),
});

/** The first validation issue, naming the field at fault when it is one of the form's. */
function invalidInput(
  error: z.ZodError,
  e: Awaited<ReturnType<typeof getErrors>>,
): { success: false; data: null; error: string; field?: CreateCollectionField } {
  const issue = error.issues[0];
  const field = issue?.path[0];
  return {
    success: false,
    data: null,
    error: e.issue(issue),
    ...(typeof field === "string" &&
      CREATE_COLLECTION_FIELDS.has(field) && { field: field as CreateCollectionField }),
  };
}

/** Prisma's "record to update/delete not found", also what another user's collection gives. */
function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
  const e = await getErrors();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error, e);

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // Read now, not from the session: the token can be a request old.
    const plan = await getPlanStatus(session.user.id);
    if (!canCreateCollection(plan)) {
      return { success: false, data: null, error: e.message("limits.collections", { max: FREE_LIMITS.collections }) };
    }

    // Re-checked under a lock in the insert, so parallel requests cannot all pass the count above.
    const collection = await createCollectionQuery(session.user.id, parsed.data, {
      maxCollections: plan.isPro ? undefined : FREE_LIMITS.collections,
    });
    return { success: true, data: collection, error: null };
  } catch (error) {
    if (error instanceof LimitReachedError) return { success: false, data: null, error: e.message("limits.collections", { max: FREE_LIMITS.collections }) };
    console.error("[collections] createCollection failed:", error);
    return { success: false, data: null, error: e.message("collections.createFailed") };
  }
}

/** The edit form sends the same fields as the create form. */
export type UpdateCollectionInput = CreateCollectionInput;

export type UpdateCollectionResult =
  | { success: true; data: CollectionSummary; error: null }
  | { success: false; data: null; error: string; field?: CreateCollectionField };

export async function updateCollection(
  collectionId: string,
  input: UpdateCollectionInput,
): Promise<UpdateCollectionResult> {
  const e = await getErrors();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error, e);

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner, so another user's collection is not found either.
    const collection = await updateCollectionQuery(session.user.id, collectionId, parsed.data);
    return { success: true, data: collection, error: null };
  } catch (error) {
    if (isNotFound(error)) return { success: false, data: null, error: e.message("collections.notFound") };
    console.error("[collections] updateCollection failed:", error);
    return { success: false, data: null, error: e.message("collections.saveFailed") };
  }
}

export type DeleteCollectionResult =
  | { success: true; data: null; error: null }
  | { success: false; data: null; error: string };

export interface DeleteCollectionOptions {
  /**
   * Set from the collection's own page. The action then redirects to `/collections`
   * itself, so the deleted page is never re-rendered into a 404 on the way out.
   */
  redirectToList?: boolean;
}

/** Deletes the collection only: its items stay, they just leave it. */
export async function deleteCollection(
  collectionId: string,
  { redirectToList = false }: DeleteCollectionOptions = {},
): Promise<DeleteCollectionResult> {
  const e = await getErrors();
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    await deleteCollectionQuery(session.user.id, collectionId);
  } catch (error) {
    if (isNotFound(error)) return { success: false, data: null, error: e.message("collections.notFound") };
    console.error("[collections] deleteCollection failed:", error);
    return { success: false, data: null, error: e.message("collections.deleteFailed") };
  }

  if (redirectToList) {
    // Outside the try: `redirect` throws Next's control-flow error, which must not be caught.
    // Revalidating the layout first refreshes the sidebar on the page it lands on.
    revalidatePath("/", "layout");
    redirect("/collections");
  }
  return { success: true, data: null, error: null };
}

export type SetCollectionFavoriteResult =
  | { success: true; data: { isFavorite: boolean }; error: null }
  | { success: false; data: null; error: string };

/** Takes the state to set, not a flip, as `setItemFavorite` does. */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetCollectionFavoriteResult> {
  const e = await getErrors();
  if (typeof isFavorite !== "boolean") return { success: false, data: null, error: e.message("collections.invalidFavorite") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    const found = await setCollectionFavoriteQuery(session.user.id, collectionId, isFavorite);
    if (!found) return { success: false, data: null, error: e.message("collections.notFound") };
  } catch (error) {
    console.error("[collections] setCollectionFavorite failed:", error);
    return { success: false, data: null, error: e.message("collections.favoriteFailed") };
  }

  revalidatePath("/", "layout");
  return { success: true, data: { isFavorite }, error: null };
}

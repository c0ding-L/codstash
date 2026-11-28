"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { invalidInput, type ActionResult } from "@/lib/action-result";
import { getPlanStatus } from "@/lib/db/billing";
import {
  createCollection as createCollectionQuery,
  deleteCollection as deleteCollectionQuery,
  setCollectionFavorite as setCollectionFavoriteQuery,
  updateCollection as updateCollectionQuery,
  type CollectionSummary,
  type RecentCollection,
} from "@/lib/db/collections";
import { collectionSchema } from "@/lib/item-schemas";
import { isPrismaNotFound } from "@/lib/prisma-errors";
import { setFlagAction } from "@/lib/set-flag-action";
import { FREE_LIMITS, LimitReachedError, canCreateCollection } from "@/lib/usage-limits";

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
}

export type CreateCollectionField = keyof CreateCollectionInput;

const CREATE_COLLECTION_FIELDS: ReadonlySet<string> = new Set<CreateCollectionField>(["name", "description"]);

export type CreateCollectionResult = ActionResult<RecentCollection, CreateCollectionField>;

export async function createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
  const e = await getErrors();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return invalidInput<CreateCollectionField>(e, parsed.error, CREATE_COLLECTION_FIELDS);

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

export type UpdateCollectionResult = ActionResult<CollectionSummary, CreateCollectionField>;

export async function updateCollection(
  collectionId: string,
  input: UpdateCollectionInput,
): Promise<UpdateCollectionResult> {
  const e = await getErrors();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return invalidInput<CreateCollectionField>(e, parsed.error, CREATE_COLLECTION_FIELDS);

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };

    // The query filters on the owner, so another user's collection is not found either.
    const collection = await updateCollectionQuery(session.user.id, collectionId, parsed.data);
    return { success: true, data: collection, error: null };
  } catch (error) {
    if (isPrismaNotFound(error)) return { success: false, data: null, error: e.message("collections.notFound") };
    console.error("[collections] updateCollection failed:", error);
    return { success: false, data: null, error: e.message("collections.saveFailed") };
  }
}

export type DeleteCollectionResult = ActionResult;

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
    if (isPrismaNotFound(error)) return { success: false, data: null, error: e.message("collections.notFound") };
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

export type SetCollectionFavoriteResult = ActionResult<{ isFavorite: boolean }>;

/** Takes the state to set, not a flip, as `setItemFavorite` does. */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetCollectionFavoriteResult> {
  return setFlagAction({
    key: "isFavorite",
    value: isFavorite,
    invalid: "collections.invalidFavorite",
    notFound: "collections.notFound",
    failed: "collections.favoriteFailed",
    log: "[collections] setCollectionFavorite",
    write: (userId, value) => setCollectionFavoriteQuery(userId, collectionId, value),
  });
}

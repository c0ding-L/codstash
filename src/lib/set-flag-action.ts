// The body of the actions that set one boolean on a user's row: favorite and pin. Server-only.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { ErrorKey } from "@/i18n/error-keys";
import { getErrors } from "@/i18n/errors-server";
import { fail, type ActionResult } from "@/lib/action-result";

interface SetFlagOptions<K extends string> {
  /** The field the result's data names, e.g. `isFavorite`. */
  key: K;
  /** The state to set, as the client sent it. */
  value: unknown;
  /** When `value` is not a boolean. */
  invalid: ErrorKey;
  /** When `write` matched no row of this user's. */
  notFound: ErrorKey;
  failed: ErrorKey;
  /** The log label, e.g. `[items] setItemFavorite`. */
  log: string;
  /** Sets the flag on the user's row; false when none matched. Filters on the owner itself. */
  write: (userId: string, value: boolean) => Promise<boolean>;
}

/**
 * Takes the state to set, not a flip, so a repeated click cannot leave the row out of step.
 * Revalidates the whole layout: the sidebar, stats and lists all read these flags.
 */
export async function setFlagAction<K extends string>({
  key,
  value,
  invalid,
  notFound,
  failed,
  log,
  write,
}: SetFlagOptions<K>): Promise<ActionResult<Record<K, boolean>>> {
  const e = await getErrors();
  if (typeof value !== "boolean") return fail(e.message(invalid));

  try {
    const session = await auth();
    if (!session?.user?.id) return fail(e.message("notSignedIn"));
    if (!(await write(session.user.id, value))) return fail(e.message(notFound));
  } catch (error) {
    console.error(`${log} failed:`, error);
    return fail(e.message(failed));
  }

  revalidatePath("/", "layout");
  return { success: true, data: { [key]: value } as Record<K, boolean>, error: null };
}

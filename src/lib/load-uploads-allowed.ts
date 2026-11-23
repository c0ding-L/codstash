import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import { canUploadFiles } from "@/lib/usage-limits";

/**
 * Whether the signed-in user may upload files and images, for the `(app)`
 * layout to stream to the New Item dialog. UI only: `createItem` and the
 * upload route check again. A failed read hides uploads, the safe side.
 * `auth()` stays outside the `try`, like `loadEditorPreferences`.
 */
export async function loadUploadsAllowed(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  try {
    return canUploadFiles(await getPlanStatus(session.user.id));
  } catch (error) {
    console.error("[layout] loading the plan failed:", error);
    return false;
  }
}

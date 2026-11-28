import { getPlanStatus } from "@/lib/db/billing";
import { loadForUser } from "@/lib/load-for-user";
import { canUploadFiles } from "@/lib/usage-limits";

/**
 * Whether the signed-in user may upload files and images, for the `(app)`
 * layout to stream to the New Item dialog. UI only: `createItem` and the
 * upload route check again. A failed read hides uploads, the safe side.
 */
export async function loadUploadsAllowed(): Promise<boolean> {
  return loadForUser(async (userId) => canUploadFiles(await getPlanStatus(userId)), false, "the plan");
}

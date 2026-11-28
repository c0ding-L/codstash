import { getPlanStatus } from "@/lib/db/billing";
import { loadForUser } from "@/lib/load-for-user";

/**
 * Whether the top bar shows its Upgrade link: Free accounts only. Streamed by
 * the `(app)` layout like `loadUploadsAllowed`. A failed read hides the link.
 */
export async function loadShowUpgrade(): Promise<boolean> {
  return loadForUser(async (userId) => !(await getPlanStatus(userId)).isPro, false, "the plan");
}

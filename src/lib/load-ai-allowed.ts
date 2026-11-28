import { getPlanStatus } from "@/lib/db/billing";
import { loadForUser } from "@/lib/load-for-user";
import { canUseAi } from "@/lib/usage-limits";

/**
 * Whether the signed-in user may use the AI features, for the `(app)` layout
 * to stream to the item forms' Suggest Tags button. UI only: the AI actions
 * check again. A failed read hides the AI features, the safe side.
 */
export async function loadAiAllowed(): Promise<boolean> {
  return loadForUser(async (userId) => canUseAi(await getPlanStatus(userId)), false, "the plan");
}

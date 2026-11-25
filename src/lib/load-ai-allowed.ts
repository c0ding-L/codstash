import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import { canUseAi } from "@/lib/usage-limits";

/**
 * Whether the signed-in user may use the AI features, for the `(app)` layout
 * to stream to the item forms' Suggest Tags button. UI only: the AI actions
 * check again. A failed read hides the AI features, the safe side.
 * `auth()` stays outside the `try`, like `loadEditorPreferences`.
 */
export async function loadAiAllowed(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  try {
    return canUseAi(await getPlanStatus(session.user.id));
  } catch (error) {
    console.error("[layout] loading the plan failed:", error);
    return false;
  }
}

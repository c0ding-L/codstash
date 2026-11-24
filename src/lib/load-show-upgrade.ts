import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";

/**
 * Whether the top bar shows its Upgrade link: Free accounts only. Streamed by
 * the `(app)` layout like `loadUploadsAllowed`. A failed read hides the link.
 */
export async function loadShowUpgrade(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  try {
    return !(await getPlanStatus(session.user.id)).isPro;
  } catch (error) {
    console.error("[layout] loading the plan failed:", error);
    return false;
  }
}

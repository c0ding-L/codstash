
import { markItemUsed } from "@/lib/db/items";
import { requireSessionUser } from "@/lib/session-route";

/**
 * Records a use of one of the user's items (A5): a copy or an opening in the drawer. A route
 * rather than a server action, because actions run one at a time per client and would hold
 * up Favorite and Pin in the drawer. 204 whether or not the throttle wrote, and for an item
 * that is missing or another user's: the query filters on the owner, and the caller fires
 * and forgets. Outside the proxy's matcher, so the session is checked here.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireSessionUser();
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  await markItemUsed(userId, (await params).id);
  return new Response(null, { status: 204 });
}

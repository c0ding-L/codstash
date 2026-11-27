import { authenticateApi } from "@/lib/api-auth";
import { apiData, apiNotFound, apiServerError } from "@/lib/api-v1";
import { getApiMe } from "@/lib/db/api-items";

/** The token's owner and plan, for `cortex whoami` and `cortex login`. */
export async function GET(request: Request) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;

  try {
    const me = await getApiMe(caller.userId);
    if (!me) return apiNotFound("user");
    return apiData(me);
  } catch (error) {
    return apiServerError("GET /me", error);
  }
}

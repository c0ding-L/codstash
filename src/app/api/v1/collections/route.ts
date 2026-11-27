import { authenticateApi } from "@/lib/api-auth";
import { apiData, apiServerError } from "@/lib/api-v1";
import { listApiCollections } from "@/lib/db/api-items";

/** Every one of the user's collections, by name, with its item count. */
export async function GET(request: Request) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;

  try {
    return apiData(await listApiCollections(caller.userId));
  } catch (error) {
    return apiServerError("GET /collections", error);
  }
}

import { z } from "zod";

import { apiError, authenticateApi } from "@/lib/api-auth";
import { createItemFromApi } from "@/lib/api-create-item";
import { apiData, apiServerError, apiValidationError, readJsonBody } from "@/lib/api-v1";
import {
  API_ITEMS_DEFAULT_LIMIT,
  API_ITEMS_MAX_LIMIT,
  decodeCursor,
  getApiItem,
  listApiItems,
} from "@/lib/db/api-items";
import { ITEM_LIMITS } from "@/lib/item-limits";

/** An optional query parameter: absent or blank is no filter. */
function optionalParam(max: number, label: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().max(max, `${label} can be at most ${max} characters.`).optional(),
  );
}

const listQuerySchema = z.object({
  q: optionalParam(200, "q"),
  type: optionalParam(100, "type"),
  tag: optionalParam(ITEM_LIMITS.tag, "tag"),
  collection: optionalParam(100, "collection"),
  idSuffix: optionalParam(8, "idSuffix").pipe(
    z.string().regex(/^[a-z0-9]{8}$/i, "idSuffix must be the last 8 characters of an item id.").optional(),
  ),
  // Above the cap is clamped to it; anything that is not a positive integer is refused.
  limit: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : Number(value)),
    z
      .number("limit must be a whole number.")
      .int("limit must be a whole number.")
      .min(1, "limit must be at least 1.")
      .transform((limit) => Math.min(limit, API_ITEMS_MAX_LIMIT))
      .default(API_ITEMS_DEFAULT_LIMIT),
  ),
  cursor: optionalParam(500, "cursor"),
});

/** A page of the user's items, newest update first. `content` is a preview; `GET /items/[id]` has it whole. */
export async function GET(request: Request) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return apiValidationError(parsed.error.issues, "The query is invalid.");

  const { cursor: rawCursor, ...filters } = parsed.data;
  const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
  if (cursor === null) {
    return apiValidationError([{ path: ["cursor"], message: "cursor is not one this API returned." }], "The query is invalid.");
  }

  try {
    const { items, nextCursor } = await listApiItems(caller.userId, { ...filters, cursor });
    return apiData(items, { nextCursor });
  } catch (error) {
    return apiServerError("GET /items", error);
  }
}

/** Creates a text item or a link: `createItemFromApi`, which the MCP server shares. */
export async function POST(request: Request) {
  const caller = await authenticateApi(request, "write");
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  const read = await readJsonBody(request);
  if (read instanceof Response) return read;

  try {
    const result = await createItemFromApi(userId, read.body);
    if (!result.ok) {
      return result.reason === "unsupported_type"
        ? apiError(422, "unsupported_type", "File and image items cannot be created through the API.")
        : apiValidationError(result.issues);
    }
    const { id } = result;

    // Read back in the API's shape. Gone already only if deleted in the same instant.
    const item = await getApiItem(userId, id);
    if (!item) return apiServerError("POST /items", new Error(`item ${id} not found after create`));
    return apiData(item, { status: 201 });
  } catch (error) {
    return apiServerError("POST /items", error);
  }
}

import { authenticateApi } from "@/lib/api-auth";
import { apiData, apiNotFound, apiServerError, apiValidationError, isPrismaNotFound, readJsonBody } from "@/lib/api-v1";
import { fieldsForType, getApiItem, getApiItemType, patchApiItem } from "@/lib/db/api-items";
import { ownsCollections } from "@/lib/db/collections";
import { updateItemSchema } from "@/lib/item-schemas";

/** Any subset of the drawer's fields; an absent field stays as it is, null clears it. */
const patchItemSchema = updateItemSchema.partial();

const TYPE_FIELD_NAMES = ["content", "url", "language"] as const;

/** One of the user's items in full: content, url, language, tags, collections, type and file `{ name, size }`. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/items/[id]">) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;

  try {
    const item = await getApiItem(caller.userId, (await ctx.params).id);
    return item ? apiData(item) : apiNotFound("item");
  } catch (error) {
    return apiServerError("GET /items/[id]", error);
  }
}

/**
 * Edits some fields of one of the user's items. A field the item's type does not use (`url` on
 * a snippet, `content` on a file) is refused, as the drawer never sends one.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/items/[id]">) {
  const caller = await authenticateApi(request, "write");
  if (caller instanceof Response) return caller;
  const { userId } = caller;

  const read = await readJsonBody(request);
  if (read instanceof Response) return read;

  const parsed = patchItemSchema.safeParse(read.body);
  if (!parsed.success) return apiValidationError(parsed.error.issues);
  const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
  if (Object.keys(patch).length === 0) {
    return apiValidationError([{ path: [], message: "Send at least one field to change." }]);
  }

  try {
    const { id } = await ctx.params;
    const type = await getApiItemType(userId, id);
    if (!type) return apiNotFound("item");

    const allowed = fieldsForType(type);
    const refused = TYPE_FIELD_NAMES.filter((field) => field in patch && !allowed.includes(field));
    if (refused.length > 0) {
      const kind = type.isSystem ? `${type.slug} items` : "items of a custom type";
      return apiValidationError(refused.map((field) => ({ path: [field], message: `${field} is not used by ${kind}.` })));
    }

    // `connect` does not filter on the owner, so the ids are checked here.
    if (parsed.data.collectionIds && !(await ownsCollections(userId, parsed.data.collectionIds))) {
      return apiValidationError([{ path: ["collectionIds"], message: "One of these collections does not exist." }]);
    }

    return apiData(await patchApiItem(userId, id, parsed.data));
  } catch (error) {
    // Deleted between the type read and the update.
    if (isPrismaNotFound(error)) return apiNotFound("item");
    return apiServerError("PATCH /items/[id]", error);
  }
}

// Creating an item from a token: the REST API's `POST /items` (C2) and the MCP server's
// `create_item` (C3) share it, so the two cannot drift. Server-only. The caller has already
// checked the write scope and Pro.

import { findCustomTypeIdBySlug } from "@/lib/db/api-items";
import { ownsCollections } from "@/lib/db/collections";
import { ownsCustomType } from "@/lib/db/item-types";
import { createItem } from "@/lib/db/items";
import { createItemSchema } from "@/lib/item-schemas";
import { isReservedTypeSlug } from "@/lib/item-type-ui";

/** A refused field: `path` as zod gives it, `message` a translation key or plain English. */
export interface CreateIssue {
  path: PropertyKey[];
  message: string;
  maximum?: number | bigint;
  minimum?: number | bigint;
}

export type ApiCreateResult =
  | { ok: true; id: string }
  /** A file or an image: they need an upload, which the API does not take. */
  | { ok: false; reason: "unsupported_type" }
  | { ok: false; reason: "invalid"; issues: CreateIssue[] };

const UNSUPPORTED = { ok: false, reason: "unsupported_type" } as const;
const invalid = (path: string, message: string): ApiCreateResult => ({ ok: false, reason: "invalid", issues: [{ path: [path], message }] });

/**
 * Creates a text item or a link from `createItemSchema`'s body. A custom type is
 * `type: "custom"` with `typeId`, or simply its slug as `type`. Writing is Pro, so the Free
 * limits do not apply.
 */
export async function createItemFromApi(userId: string, input: unknown): Promise<ApiCreateResult> {
  let body = input;
  // Before validation: a file sent without `fileKey` must still answer `unsupported_type`.
  const type = typeof body === "object" && body !== null && "type" in body ? body.type : undefined;
  if (type === "file" || type === "image") return UNSUPPORTED;
  // A custom type by its slug. Custom slugs never take a system or reserved slug.
  if (typeof type === "string" && type !== "custom" && !isReservedTypeSlug(type)) {
    const typeId = await findCustomTypeIdBySlug(userId, type);
    if (!typeId) return invalid("type", `No item type "${type}".`);
    body = { ...(body as object), type: "custom", typeId };
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: "invalid", issues: parsed.error.issues };
  const data = parsed.data;
  // Narrowed for TypeScript; refused above.
  if (data.type === "file" || data.type === "image") return UNSUPPORTED;

  // `connect` does not filter on the owner, so the ids are checked here.
  if (!(await ownsCollections(userId, data.collectionIds))) {
    return invalid("collectionIds", "One of these collections does not exist.");
  }

  if (data.type === "custom") {
    const { typeId, ...fields } = data;
    if (!(await ownsCustomType(userId, typeId))) return invalid("typeId", "No custom item type has this id.");
    const { id } = await createItem(userId, { ...fields, type: { customTypeId: typeId } });
    return { ok: true, id };
  }
  const { id } = await createItem(userId, data);
  return { ok: true, id };
}

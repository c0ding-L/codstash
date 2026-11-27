// The reads and writes of the REST API (C2). Every query filters on the token owner's id.
// Server-only. Responses never carry an item's R2 key (`fileUrl`): a file is `{ name, size }`.

import type { Prisma } from "@/generated/prisma/client";
import { getPlanStatus } from "@/lib/db/billing";
import { clampLimit } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";
import { FREE_LIMITS } from "@/lib/usage-limits";

export const API_ITEMS_DEFAULT_LIMIT = 20;
export const API_ITEMS_MAX_LIMIT = 50;
/** A list item's content is cut to this many characters; `GET /items/[id]` has it whole. */
export const API_PREVIEW_CHARS = 300;

/** Where a page of items starts: just after this item in `updatedAt desc, id desc` order. */
export interface ApiCursor {
  updatedAt: Date;
  id: string;
}

/** Opaque to clients: base64url of `{ u, i }`. */
export function encodeCursor({ updatedAt, id }: ApiCursor): string {
  return Buffer.from(JSON.stringify({ u: updatedAt.toISOString(), i: id })).toString("base64url");
}

/** Null when the cursor is not one `encodeCursor` made. */
export function decodeCursor(cursor: string): ApiCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { u, i } = parsed as { u?: unknown; i?: unknown };
    if (typeof u !== "string" || typeof i !== "string" || i.length === 0) return null;
    const updatedAt = new Date(u);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { updatedAt, id: i };
  } catch {
    return null;
  }
}

export interface ApiItemFilters {
  q?: string;
  /** A system type's slug or one of the user's custom types' slugs. */
  type?: string;
  /** An exact tag name. */
  tag?: string;
  /** A collection id. */
  collection?: string;
  /** The last 8 characters of an id: the CLI's short ids. */
  idSuffix?: string;
  limit?: number;
  cursor?: ApiCursor;
}

/**
 * The `where` of a list query. `q` and the cursor are both `OR`s, so each sits in its own entry
 * of `AND`; `userId` is set last, so nothing can override it.
 */
export function buildItemsWhere(userId: string, filters: ApiItemFilters): Prisma.ItemWhereInput {
  const and: Prisma.ItemWhereInput[] = [];
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" } as const;
    and.push({
      OR: [
        { title: contains },
        { description: contains },
        { content: contains },
        { tags: { some: { tag: { name: filters.q } } } },
      ],
    });
  }
  if (filters.type) and.push({ type: { slug: filters.type } });
  if (filters.tag) and.push({ tags: { some: { tag: { name: filters.tag } } } });
  if (filters.collection) and.push({ collections: { some: { collectionId: filters.collection } } });
  if (filters.idSuffix) and.push({ id: { endsWith: filters.idSuffix } });
  if (filters.cursor) {
    const { updatedAt, id } = filters.cursor;
    and.push({ OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: id } }] });
  }
  return { ...(and.length > 0 && { AND: and }), userId };
}

const apiItemSelect = {
  id: true,
  title: true,
  description: true,
  content: true,
  url: true,
  language: true,
  fileName: true,
  fileSize: true,
  isFavorite: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  type: { select: { id: true, slug: true, name: true, isSystem: true } },
  tags: { select: { tag: { select: { name: true } } } },
  collections: {
    select: { collection: { select: { id: true, name: true } } },
    orderBy: { collection: { name: "asc" } },
  },
} satisfies Prisma.ItemSelect;

type SelectedApiItem = Prisma.ItemGetPayload<{ select: typeof apiItemSelect }>;

/** An item as the API returns it. Dates stay `Date` here; `Response.json` writes them as ISO strings. */
export interface ApiItem {
  id: string;
  title: string;
  description: string | null;
  type: { id: string; slug: string; name: string; isSystem: boolean };
  content: string | null;
  url: string | null;
  language: string | null;
  /** Set for file and image items; the bytes are never served by the API. */
  file: { name: string | null; size: number | null } | null;
  tags: string[];
  collections: { id: string; name: string }[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A list item: the content cut to `API_PREVIEW_CHARS`, flagged when it was. */
export interface ApiItemPreview extends ApiItem {
  truncated: boolean;
}

function toApiItem({ fileName, fileSize, tags, collections, ...item }: SelectedApiItem): ApiItem {
  return {
    ...item,
    file: fileName !== null || fileSize !== null ? { name: fileName, size: fileSize } : null,
    tags: tags.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b)),
    collections: collections.map(({ collection }) => collection),
  };
}

function toPreview(item: ApiItem): ApiItemPreview {
  const truncated = item.content !== null && item.content.length > API_PREVIEW_CHARS;
  return { ...item, content: truncated ? item.content!.slice(0, API_PREVIEW_CHARS) : item.content, truncated };
}

/** One page of the user's items, newest update first, and the cursor of the next page (null at the end). */
export async function listApiItems(
  userId: string,
  filters: ApiItemFilters,
): Promise<{ items: ApiItemPreview[]; nextCursor: string | null }> {
  const limit = clampLimit(filters.limit ?? API_ITEMS_DEFAULT_LIMIT, API_ITEMS_MAX_LIMIT);
  // One more than the page, to know whether another page follows.
  const rows = await prisma.item.findMany({
    where: buildItemsWhere(userId, filters),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: apiItemSelect,
  });

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last) : null;
  return { items: page.map((row) => toPreview(toApiItem(row))), nextCursor };
}

/** One of the user's items in full, or null when it is missing or someone else's. */
export async function getApiItem(userId: string, id: string): Promise<ApiItem | null> {
  const item = await prisma.item.findFirst({ where: { id, userId }, select: apiItemSelect });
  return item ? toApiItem(item) : null;
}

/** The fields each type uses beyond title, description, tags and collections. A custom type is a note plus a language. */
const TYPE_FIELDS: Record<string, readonly ("content" | "url" | "language")[]> = {
  snippet: ["content", "language"],
  command: ["content", "language"],
  prompt: ["content"],
  note: ["content"],
  link: ["url"],
  file: [],
  image: [],
};
const CUSTOM_TYPE_FIELDS = ["content", "language"] as const;

/** The type-specific fields an item of this type can hold. */
export function fieldsForType(type: { slug: string; isSystem: boolean }): readonly ("content" | "url" | "language")[] {
  return type.isSystem ? (TYPE_FIELDS[type.slug] ?? []) : CUSTOM_TYPE_FIELDS;
}

/** The type of one of the user's items, or null when it is missing or someone else's. */
export async function getApiItemType(userId: string, id: string): Promise<{ slug: string; isSystem: boolean } | null> {
  const item = await prisma.item.findFirst({ where: { id, userId }, select: { type: { select: { slug: true, isSystem: true } } } });
  return item?.type ?? null;
}

/** A partial edit: an absent field is left as it is, null clears it. */
export interface ApiItemPatch {
  title?: string;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  language?: string | null;
  /** Replaces every tag when present. */
  tags?: string[];
  /** Replaces every collection when present. Must be the user's own. */
  collectionIds?: string[];
}

/**
 * Applies a partial edit to one of the user's items and returns it in full. Filtered on the
 * owner, so another user's item throws Prisma's P2025 as a missing one does. Unlike the drawer's
 * `updateItem`, the tags and collections are rewritten only when they are sent.
 */
export async function patchApiItem(
  userId: string,
  id: string,
  { tags, collectionIds, ...fields }: ApiItemPatch,
): Promise<ApiItem> {
  const updated = await prisma.item.update({
    where: { id, userId },
    data: {
      ...fields,
      ...(tags && {
        tags: {
          deleteMany: {},
          create: [...new Set(tags)].map((name) => ({
            tag: { connectOrCreate: { where: { userId_name: { userId, name } }, create: { name, userId } } },
          })),
        },
      }),
      ...(collectionIds && {
        collections: {
          deleteMany: {},
          create: [...new Set(collectionIds)].map((collectionId) => ({ collection: { connect: { id: collectionId } } })),
        },
      }),
    },
    select: apiItemSelect,
  });
  return toApiItem(updated);
}

/** The id of one of the user's custom types by its slug, or null. */
export async function findCustomTypeIdBySlug(userId: string, slug: string): Promise<string | null> {
  const type = await prisma.itemType.findFirst({ where: { userId, slug, isSystem: false }, select: { id: true } });
  return type?.id ?? null;
}

export interface ApiCollection {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

/** Every one of the user's collections, by name, with its item count. */
export async function listApiCollections(userId: string): Promise<ApiCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, description: true, _count: { select: { items: true } } },
  });
  return rows.map(({ _count, ...collection }) => ({ ...collection, itemCount: _count.items }));
}

/** A plan limit: how much is used and the cap, null on Pro. */
export interface ApiLimit {
  used: number;
  max: number | null;
}

export interface ApiMe {
  id: string;
  name: string | null;
  email: string;
  isPro: boolean;
  proUntil: Date | null;
  limits: { items: ApiLimit; collections: ApiLimit };
}

/** The token owner for `GET /me`, or null when the account is gone. */
export async function getApiMe(userId: string): Promise<ApiMe | null> {
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    getPlanStatus(userId),
  ]);
  if (!user) return null;
  return {
    ...user,
    isPro: plan.isPro,
    proUntil: plan.proUntil,
    limits: {
      items: { used: plan.items, max: plan.isPro ? null : FREE_LIMITS.items },
      collections: { used: plan.collections, max: plan.isPro ? null : FREE_LIMITS.collections },
    },
  };
}

const mcpPromptSelect = { id: true, title: true, description: true, content: true } satisfies Prisma.ItemSelect;
/** The system `prompt` type only: a custom type with the slug "prompt" cannot exist (reserved). */
const promptWhere = (userId: string) => ({ userId, type: { slug: "prompt", isSystem: true } }) satisfies Prisma.ItemWhereInput;

/** The user's `take` most recently updated prompts, for the MCP server's `prompts/list` (C3). */
export async function listMcpPromptRows(userId: string, take: number) {
  return prisma.item.findMany({
    where: promptWhere(userId),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: mcpPromptSelect,
  });
}

/** The user's prompts whose id ends with `idSuffix`, for `prompts/get`: the caller matches the full name. */
export async function findMcpPromptRows(userId: string, idSuffix: string) {
  return prisma.item.findMany({
    where: { ...promptWhere(userId), id: { endsWith: idSuffix } },
    take: 10,
    select: mcpPromptSelect,
  });
}

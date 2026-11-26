import { cache } from "react";

import { isReservedTypeSlug, itemTypeFromSegment, slugify } from "@/lib/item-type-ui";
import { prisma } from "@/lib/prisma";
import { LimitReachedError } from "@/lib/usage-limits";
import type { ItemTypeSlug } from "@/types/item-type";

/** A Pro user's own item type, as Settings and the sidebar list it. */
export interface CustomType {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  template: string | null;
  isSystem: false;
  /** The user's items of this type. */
  itemCount: number;
}

/** The fields a custom type is created or edited with. The slug comes from the name. */
export interface CustomTypeData {
  name: string;
  slug: string;
  icon: string;
  color: string;
  template: string | null;
}

export const MAX_CUSTOM_TYPES = 20;

const customTypeSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
  color: true,
  template: true,
} as const;

/**
 * The user's custom types, by name, with their item counts. Cached per request: the sidebar,
 * the top bar's dialog and a type page all read it.
 */
export const getCustomTypes = cache(async (userId: string): Promise<CustomType[]> => {
  const types = await prisma.itemType.findMany({
    where: { userId, isSystem: false },
    select: { ...customTypeSelect, _count: { select: { items: { where: { userId } } } } },
    orderBy: { name: "asc" },
  });
  return types.map(({ _count, ...type }) => ({ ...type, isSystem: false, itemCount: _count.items }));
});

/** One of the user's custom types by its slug, for `/items/<slug>`; null when they have none. */
export async function getCustomTypeBySlug(userId: string, slug: string) {
  return prisma.itemType.findFirst({
    where: { userId, slug, isSystem: false },
    select: { ...customTypeSelect, isSystem: true },
  });
}

/** Whether this id is one of the user's custom types; a system type or another user's is not. */
export async function ownsCustomType(userId: string, typeId: string): Promise<boolean> {
  const type = await prisma.itemType.findFirst({
    where: { id: typeId, userId, isSystem: false },
    select: { id: true },
  });
  return type !== null;
}

/** Whether another of the user's custom types already has this name, ignoring case. */
export async function isCustomTypeNameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
  const type = await prisma.itemType.findFirst({
    where: {
      userId,
      isSystem: false,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return type !== null;
}

/**
 * Creates a custom type. The count is re-checked under a lock on the user row, so parallel
 * requests cannot pass the cap together. Throws `LimitReachedError` at the cap, and Prisma's
 * P2002 when the slug is taken.
 */
export async function createCustomType(userId: string, data: CustomTypeData) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const count = await tx.itemType.count({ where: { userId, isSystem: false } });
    if (count >= MAX_CUSTOM_TYPES) throw new LimitReachedError("customTypes");
    return tx.itemType.create({
      data: { ...data, isSystem: false, user: { connect: { id: userId } } },
      select: { id: true, slug: true },
    });
  });
}

/**
 * Updates one of the user's custom types. Filtered on the owner and `isSystem: false`, so a
 * system type or another user's throws Prisma's P2025 as a missing one does; P2002 when the
 * new slug is taken.
 */
export async function updateCustomType(userId: string, id: string, data: CustomTypeData) {
  return prisma.itemType.update({
    where: { id, userId, isSystem: false },
    data,
    select: { id: true, slug: true },
  });
}

export type DeleteCustomTypeResult = { deleted: true } | { deleted: false; itemCount: number } | null;

/**
 * Deletes one of the user's custom types when no item uses it. Null when it is not theirs (or
 * is a system type). `onDelete: Restrict` on `Item.type` still refuses an item added meanwhile,
 * with P2003.
 */
export async function deleteCustomType(userId: string, id: string): Promise<DeleteCustomTypeResult> {
  const type = await prisma.itemType.findFirst({
    where: { id, userId, isSystem: false },
    select: { _count: { select: { items: true } } },
  });
  if (!type) return null;
  if (type._count.items > 0) return { deleted: false, itemCount: type._count.items };

  await prisma.itemType.delete({ where: { id, userId, isSystem: false } });
  return { deleted: true };
}

export type TypeSegment =
  | { kind: "system"; slug: ItemTypeSlug }
  | { kind: "custom"; type: NonNullable<Awaited<ReturnType<typeof getCustomTypeBySlug>>> };

/**
 * What `/items/<segment>` lists: a system plural (`snippets`), else the user's custom type of
 * that slug, else null (404). Cached per request: the layout, `generateMetadata` and the page
 * all ask. A system plural never reaches the database.
 */
export const resolveTypeSegment = cache(async (userId: string, segment: string): Promise<TypeSegment | null> => {
  const slug = itemTypeFromSegment(segment);
  if (slug) return { kind: "system", slug };
  if (isReservedTypeSlug(segment) || slugify(segment) !== segment) return null;
  const type = await getCustomTypeBySlug(userId, segment);
  return type ? { kind: "custom", type } : null;
});

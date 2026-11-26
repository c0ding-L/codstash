import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";

import { clampLimit, MAX_COLLECTION_LIMIT } from "@/lib/db/limits";
import { COLLECTIONS_PER_PAGE, DASHBOARD_COLLECTIONS_LIMIT, pageOffset } from "@/lib/pagination";
import { assertBelowLimit } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import type { TypeRef } from "@/types/item-type";

/** The seeded demo account, which the profile page refuses to delete. */
export const DEMO_USER_EMAIL = "demo@codstash.io";

export interface ItemTypeRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
}

/** System types plus any custom types the user owns. */
export const getItemTypes = cache(
  async (userId: string): Promise<ItemTypeRow[]> =>
    prisma.itemType.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, slug: true, name: true, icon: true, color: true, isSystem: true },
      orderBy: { slug: "asc" },
    }),
);

/** One item type present in a collection, with how many items carry it. */
export interface CollectionType extends TypeRef {
  count: number;
}

type TypeLookup = Map<string, TypeRef>;

async function loadTypeLookup(userId: string): Promise<TypeLookup> {
  const itemTypes = await getItemTypes(userId);

  return new Map(itemTypes.map((type) => [type.id, type]));
}

/** How many items of one type a collection holds. */
interface TypeCount {
  typeId: string;
  count: number;
}

/**
 * Item counts per type for each collection, grouped in the database, so the
 * cost scales with collections × types rather than with every item row. A
 * collection with no items has no entry. Raw SQL because Prisma's `groupBy`
 * cannot group the links by a column of the linked item.
 */
async function loadTypeCounts(
  userId: string,
  collectionIds: string[],
): Promise<Map<string, TypeCount[]>> {
  const byCollection = new Map<string, TypeCount[]>();
  if (collectionIds.length === 0) return byCollection;

  const groups = await prisma.$queryRaw<{ collectionId: string; typeId: string; count: bigint }[]>`
    SELECT ic."collectionId", i."typeId", COUNT(*) AS "count"
    FROM "ItemCollection" ic
    JOIN "Item" i ON i."id" = ic."itemId"
    WHERE i."userId" = ${userId} AND ic."collectionId" IN (${Prisma.join(collectionIds)})
    GROUP BY ic."collectionId", i."typeId"
  `;

  for (const group of groups) {
    const counts = byCollection.get(group.collectionId) ?? [];
    counts.push({ typeId: group.typeId, count: Number(group.count) });
    byCollection.set(group.collectionId, counts);
  }

  return byCollection;
}

/** Most-used first; ties break on slug so accents cannot flip between renders. */
export function aggregateCollectionTypes(
  counts: TypeCount[],
  typeById: TypeLookup,
): CollectionType[] {
  const types: CollectionType[] = [];
  for (const { typeId, count } of counts) {
    const type = typeById.get(typeId);
    if (type) {
      types.push({ slug: type.slug, name: type.name, icon: type.icon, color: type.color, isSystem: type.isSystem, count });
    }
  }

  types.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return types;
}

export interface SidebarCollection {
  id: string;
  name: string;
  types: CollectionType[];
}

async function getCollectionsWithTypes(
  userId: string,
  where: Prisma.CollectionWhereInput,
  orderBy: Prisma.CollectionOrderByWithRelationInput | Prisma.CollectionOrderByWithRelationInput[],
  // Always bounded: with no limit passed, the ceiling applies.
  limit: number = MAX_COLLECTION_LIMIT,
): Promise<SidebarCollection[]> {
  const [collections, typeById] = await Promise.all([
    prisma.collection.findMany({
      where: { userId, ...where },
      orderBy,
      take: clampLimit(limit, MAX_COLLECTION_LIMIT),
    }),
    loadTypeLookup(userId),
  ]);
  const typeCounts = await loadTypeCounts(
    userId,
    collections.map((collection) => collection.id),
  );

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    types: aggregateCollectionTypes(typeCounts.get(collection.id) ?? [], typeById),
  }));
}

/** Matches the mock's favourite slice — one today (Design Resources). */
export async function getFavoriteCollections(userId: string): Promise<SidebarCollection[]> {
  return getCollectionsWithTypes(userId, { isFavorite: true }, { name: "asc" });
}

/** Matches the mock's five-row recent slice in the sidebar. */
const SIDEBAR_RECENT_LIMIT = 5;

export async function getSidebarRecentCollections(
  userId: string,
  limit: number = SIDEBAR_RECENT_LIMIT,
): Promise<SidebarCollection[]> {
  return getCollectionsWithTypes(userId, {}, { updatedAt: "desc" }, limit);
}

export interface RecentCollection {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  updatedAt: Date;
  /**
   * Every type present, most-used first. Ties break on slug so the card's
   * accent colour cannot flip between renders. Empty for an empty collection.
   */
  types: CollectionType[];
}

/**
 * The user's collections as cards, most recently updated first, from `skip` on.
 * `where` narrows them; `userId` is set after it, so it cannot be overridden.
 */
async function loadCollectionCards(
  userId: string,
  skip: number,
  take: number,
  where: Prisma.CollectionWhereInput = {},
): Promise<RecentCollection[]> {
  const [collections, typeById] = await Promise.all([
    prisma.collection.findMany({
      where: { ...where, userId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take,
      include: { _count: { select: { items: true } } },
    }),
    loadTypeLookup(userId),
  ]);
  const typeCounts = await loadTypeCounts(
    userId,
    collections.map((collection) => collection.id),
  );

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isFavorite: collection.isFavorite,
    itemCount: collection._count.items,
    updatedAt: collection.updatedAt,
    types: aggregateCollectionTypes(typeCounts.get(collection.id) ?? [], typeById),
  }));
}

/** The dashboard's cards; the seed has five, and nothing is padded. */
export async function getRecentCollections(
  userId: string,
  limit: number = DASHBOARD_COLLECTIONS_LIMIT,
): Promise<RecentCollection[]> {
  return loadCollectionCards(userId, 0, clampLimit(limit, MAX_COLLECTION_LIMIT));
}

/** Every collection the user owns, most recently updated first, up to the ceiling. */
export async function getCollections(userId: string): Promise<RecentCollection[]> {
  return getRecentCollections(userId, MAX_COLLECTION_LIMIT);
}

/**
 * Favorite collections for `/favorites`, most recently updated first, up to the
 * ceiling. The sidebar's `getFavoriteCollections` sorts by name and drops the counts.
 */
export async function getFavoriteCollectionCards(userId: string): Promise<RecentCollection[]> {
  return loadCollectionCards(userId, 0, MAX_COLLECTION_LIMIT, { isFavorite: true });
}

/** One page of the user's collections for `/collections`, plus the total so the page can count its pages. */
export async function getCollectionsPage(
  userId: string,
  page: number = 1,
): Promise<{ collections: RecentCollection[]; totalCount: number }> {
  const [collections, totalCount] = await Promise.all([
    loadCollectionCards(userId, pageOffset(page, COLLECTIONS_PER_PAGE), COLLECTIONS_PER_PAGE),
    prisma.collection.count({ where: { userId } }),
  ]);

  return { collections, totalCount };
}

/** A collection as the command palette lists it. */
export interface SearchCollection {
  id: string;
  name: string;
  itemCount: number;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
}

const COLLECTION_SUMMARY_SELECT = { id: true, name: true, description: true, isFavorite: true } as const;

/**
 * One collection, or null when it does not exist or is another user's. Cached per
 * request so the layout's 404 check and the page share one query.
 */
export const getCollection = cache(
  async (userId: string, id: string): Promise<CollectionSummary | null> =>
    prisma.collection.findFirst({
      where: { id, userId },
      select: COLLECTION_SUMMARY_SELECT,
    }),
);

export interface CollectionCreate {
  name: string;
  description?: string | null;
}

/** Creates an empty collection owned by `userId`, shaped like a dashboard card. */
export async function createCollection(
  userId: string,
  { name, description }: CollectionCreate,
  /** The Free collection limit, re-checked under a lock; omitted for Pro. */
  { maxCollections }: { maxCollections?: number } = {},
): Promise<RecentCollection> {
  const args = {
    data: { name, description: description ?? null, user: { connect: { id: userId } } },
    select: { id: true, name: true, description: true, isFavorite: true, updatedAt: true },
  };
  const created =
    maxCollections === undefined
      ? await prisma.collection.create(args)
      : await prisma.$transaction(async (tx) => {
          await assertBelowLimit(tx, userId, "collections", maxCollections);
          return tx.collection.create(args);
        });

  return { ...created, itemCount: 0, types: [] };
}

/**
 * Renames or re-describes one of the user's collections. Throws Prisma's P2025 when it
 * does not exist or is another user's.
 */
export async function updateCollection(
  userId: string,
  id: string,
  { name, description }: CollectionCreate,
): Promise<CollectionSummary> {
  return prisma.collection.update({
    where: { id, userId },
    data: { name, description: description ?? null },
    select: COLLECTION_SUMMARY_SELECT,
  });
}

/**
 * Deletes one of the user's collections. Only its `ItemCollection` links go with it
 * (cascade); the items themselves stay. Throws P2025 when it is not the user's.
 */
export async function deleteCollection(userId: string, id: string): Promise<void> {
  await prisma.collection.delete({ where: { id, userId }, select: { id: true } });
}

export interface CollectionOption {
  id: string;
  name: string;
}

/** The user's collections for the item forms' picker, by name, up to the ceiling. */
export async function getCollectionOptions(userId: string): Promise<CollectionOption[]> {
  return prisma.collection.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: MAX_COLLECTION_LIMIT,
  });
}

/** Whether every one of these ids is a collection the user owns. */
export async function ownsCollections(userId: string, collectionIds: string[]): Promise<boolean> {
  const ids = [...new Set(collectionIds)];
  if (ids.length === 0) return true;
  const owned = await prisma.collection.count({ where: { userId, id: { in: ids } } });
  return owned === ids.length;
}

/** Like `setItemFavorite`, for a collection: raw SQL so `updatedAt` stays as it was. */
export async function setCollectionFavorite(userId: string, id: string, isFavorite: boolean): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "Collection" SET "isFavorite" = ${isFavorite} WHERE "id" = ${id} AND "userId" = ${userId}
  `;
  return updated > 0;
}

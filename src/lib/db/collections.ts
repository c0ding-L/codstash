import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";

import { clampLimit, MAX_COLLECTION_LIMIT } from "@/lib/db/limits";
import { prisma } from "@/lib/prisma";

/**
 * The dashboard has no session yet — NextAuth is installed but not configured.
 * Every query needs a `userId`, so the seeded demo account stands in for one.
 * This is the single seam to delete once auth lands: the queries below take a
 * `userId` and know nothing about the demo user.
 */
export const DEMO_USER_EMAIL = "demo@codstash.io";

// `cache` memoises per request, so the five dashboard components that each ask
// for the user share one query per render. It never outlives the request.
export const getDemoUserId = cache(async () => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      `No user with email ${DEMO_USER_EMAIL}. Run \`npm run db:seed\` first.`,
    );
  }

  return user.id;
});

export interface DemoUser {
  name: string | null;
  email: string;
  image: string | null;
}

/** Footer avatar block — same demo account as `getDemoUserId`. */
export const getDemoUser = cache(async (): Promise<DemoUser> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { name: true, email: true, image: true },
  });

  if (!user) {
    throw new Error(
      `No user with email ${DEMO_USER_EMAIL}. Run \`npm run db:seed\` first.`,
    );
  }

  return user;
});

export interface ItemTypeRow {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

/** System types plus any custom types the user owns. */
export const getItemTypes = cache(
  async (userId: string): Promise<ItemTypeRow[]> =>
    prisma.itemType.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, slug: true, name: true, color: true },
      orderBy: { slug: "asc" },
    }),
);

/** One item type present in a collection, with how many items carry it. */
export interface CollectionType {
  slug: string;
  name: string;
  color: string | null;
  count: number;
}

type TypeLookup = Map<string, { slug: string; name: string; color: string | null }>;

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
      types.push({ slug: type.slug, name: type.name, color: type.color, count });
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

/** The spec asks for six cards; the seed has five, and nothing is padded. */
const RECENT_LIMIT = 6;

export async function getRecentCollections(
  userId: string,
  limit: number = RECENT_LIMIT,
): Promise<RecentCollection[]> {
  const [collections, typeById] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(limit, MAX_COLLECTION_LIMIT),
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

export interface CollectionCreate {
  name: string;
  description?: string | null;
}

/** Creates an empty collection owned by `userId`, shaped like a dashboard card. */
export async function createCollection(
  userId: string,
  { name, description }: CollectionCreate,
): Promise<RecentCollection> {
  const created = await prisma.collection.create({
    data: { name, description: description ?? null, user: { connect: { id: userId } } },
    select: { id: true, name: true, description: true, isFavorite: true, updatedAt: true },
  });

  return { ...created, itemCount: 0, types: [] };
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

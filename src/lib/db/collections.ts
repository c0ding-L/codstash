import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The dashboard has no session yet — NextAuth is installed but not configured.
 * Every query needs a `userId`, so the seeded demo account stands in for one.
 * This is the single seam to delete once auth lands: the queries below take a
 * `userId` and know nothing about the demo user.
 */
const DEMO_USER_EMAIL = "demo@codstash.io";

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
 * Item counts per type for each collection, from one `groupBy`, so the cost
 * scales with collections × types rather than with every item row. A collection
 * with no items has no entry.
 */
async function loadTypeCounts(
  userId: string,
  collectionIds: string[],
): Promise<Map<string, TypeCount[]>> {
  const byCollection = new Map<string, TypeCount[]>();
  if (collectionIds.length === 0) return byCollection;

  const groups = await prisma.item.groupBy({
    by: ["collectionId", "typeId"],
    where: { userId, collectionId: { in: collectionIds } },
    _count: { _all: true },
  });

  for (const group of groups) {
    if (!group.collectionId) continue;
    const counts = byCollection.get(group.collectionId) ?? [];
    counts.push({ typeId: group.typeId, count: group._count._all });
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
  limit?: number,
): Promise<SidebarCollection[]> {
  const [collections, typeById] = await Promise.all([
    prisma.collection.findMany({
      where: { userId, ...where },
      orderBy,
      take: limit,
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
      take: limit,
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

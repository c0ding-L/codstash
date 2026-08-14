import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The dashboard has no session yet — NextAuth is installed but not configured.
 * Every query needs a `userId`, so the seeded demo account stands in for one.
 * This is the single seam to delete once auth lands: the queries below take a
 * `userId` and know nothing about the demo user.
 */
const DEMO_USER_EMAIL = "demo@codstash.io";

export async function getDemoUserId() {
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
}

export interface DemoUser {
  name: string | null;
  email: string;
  image: string | null;
}

/** Footer avatar block — same demo account as `getDemoUserId`. */
export async function getDemoUser(): Promise<DemoUser> {
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
}

export interface ItemTypeRow {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

/** System types plus any custom types the user owns. */
export async function getItemTypes(userId: string): Promise<ItemTypeRow[]> {
  return prisma.itemType.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    select: { id: true, slug: true, name: true, color: true },
    orderBy: { slug: "asc" },
  });
}

/** One item type present in a collection, with how many items carry it. */
export interface CollectionType {
  slug: string;
  name: string;
  color: string | null;
  count: number;
}

type TypeLookup = Map<string, { slug: string; name: string; color: string | null }>;

async function loadTypeLookup(userId: string): Promise<TypeLookup> {
  const itemTypes = await prisma.itemType.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    select: { id: true, slug: true, name: true, color: true },
  });

  return new Map(itemTypes.map((type) => [type.id, type]));
}

/** Most-used first; ties break on slug so accents cannot flip between renders. */
export function aggregateCollectionTypes(
  items: { typeId: string }[],
  typeById: TypeLookup,
): CollectionType[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + 1);
  }

  const types: CollectionType[] = [];
  for (const [typeId, count] of counts) {
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
      include: { items: { select: { typeId: true } } },
    }),
    loadTypeLookup(userId),
  ]);

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    types: aggregateCollectionTypes(collection.items, typeById),
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
      include: {
        items: { select: { typeId: true } },
        _count: { select: { items: true } },
      },
    }),
    loadTypeLookup(userId),
  ]);

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isFavorite: collection.isFavorite,
    itemCount: collection._count.items,
    updatedAt: collection.updatedAt,
    types: aggregateCollectionTypes(collection.items, typeById),
  }));
}

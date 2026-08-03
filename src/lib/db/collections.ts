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

/** One item type present in a collection, with how many items carry it. */
export interface CollectionType {
  slug: string;
  name: string;
  color: string | null;
  count: number;
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
  // Two queries rather than one per collection: the items come back with the
  // collections, and the type rows are looked up once for all of them.
  const [collections, itemTypes] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        items: { select: { typeId: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.itemType.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, slug: true, name: true, color: true },
    }),
  ]);

  const typeById = new Map(itemTypes.map((type) => [type.id, type]));

  return collections.map((collection) => {
    const counts = new Map<string, number>();
    for (const item of collection.items) {
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

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
      itemCount: collection._count.items,
      updatedAt: collection.updatedAt,
      types,
    };
  });
}

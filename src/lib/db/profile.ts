import { getItemTypes } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";
import { toColorToken, toItemTypeSlug } from "@/lib/item-type-ui";
import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date;
  /** Email/password account; GitHub-only accounts have no password to change. */
  hasPassword: boolean;
}

/** `null` when the row is gone, e.g. a JWT that outlived a deleted account. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, createdAt: true, password: true },
  });
  if (!user) return null;

  const { password, ...rest } = user;
  return { ...rest, hasPassword: password !== null };
}

/** The order the spec lists them in. */
const BREAKDOWN_ORDER: ItemTypeSlug[] = ["snippet", "prompt", "note", "command", "link", "file", "image"];

export interface TypeCount {
  slug: ItemTypeSlug;
  color: ColorToken | null;
  count: number;
}

export interface ProfileStats {
  totalItems: number;
  collectionCount: number;
  /** All seven system types, zeros included. Items of other custom types count in `totalItems` only. */
  byType: TypeCount[];
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [totalItems, collectionCount, grouped, types] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.item.groupBy({ by: ["typeId"], where: { userId }, _count: { _all: true } }),
    getItemTypes(userId),
  ]);

  const countByTypeId = new Map(grouped.map((row) => [row.typeId, row._count._all]));
  const bySlug = new Map<ItemTypeSlug, TypeCount>();
  for (const type of types) {
    const slug = toItemTypeSlug(type.slug);
    if (!slug) continue;
    const count = countByTypeId.get(type.id) ?? 0;
    // A custom type may reuse a system slug; its items join that row.
    const existing = bySlug.get(slug);
    if (existing) existing.count += count;
    else bySlug.set(slug, { slug, color: toColorToken(type.color), count });
  }

  return {
    totalItems,
    collectionCount,
    byType: BREAKDOWN_ORDER.map((slug) => bySlug.get(slug) ?? { slug, color: null, count: 0 }),
  };
}

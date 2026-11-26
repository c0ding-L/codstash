import { getItemTypes } from "@/lib/db/collections";
import { parseEditorPreferences, type EditorPreferences } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";
import type { ItemTypeSlug, TypeRef } from "@/types/item-type";

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

/** The defaults for a user with nothing saved, or whose row is gone. */
export async function getEditorPreferences(userId: string): Promise<EditorPreferences> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { editorPreferences: true } });
  return parseEditorPreferences(user?.editorPreferences);
}

/** The order the spec lists them in. */
const BREAKDOWN_ORDER: ItemTypeSlug[] = ["snippet", "prompt", "note", "command", "link", "file", "image"];

/** One row of the breakdown: a type, system or custom, with the user's item count. */
export interface TypeCount extends TypeRef {
  count: number;
}

export interface ProfileStats {
  totalItems: number;
  collectionCount: number;
  /** All seven system types, zeros included, then the user's custom types by name. */
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
  const toRow = ({ slug, name, icon, color, isSystem, id }: (typeof types)[number]): TypeCount => ({
    slug,
    name,
    icon,
    color,
    isSystem,
    count: countByTypeId.get(id) ?? 0,
  });

  const system = new Map(types.filter((type) => type.isSystem).map((type) => [type.slug, type]));
  const custom = types
    .filter((type) => !type.isSystem)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toRow);

  return {
    totalItems,
    collectionCount,
    byType: [
      ...BREAKDOWN_ORDER.map((slug) => {
        const type = system.get(slug);
        return type ? toRow(type) : { slug, name: slug, icon: null, color: null, isSystem: true, count: 0 };
      }),
      ...custom,
    ],
  };
}

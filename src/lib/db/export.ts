import type { ExportCollectionRow, ExportItemRow, ExportTypeRow, ExportUserRow } from "@/lib/export";
import { prisma } from "@/lib/prisma";

/**
 * Items per read. An item's content can reach 100,000 characters, so a page stays
 * around 10 MB at worst.
 */
export const EXPORT_PAGE_SIZE = 100;

/** The small parts of the export, read whole: the user, their custom types and collections. Null without a user row. */
export async function getExportHeaderData(
  userId: string,
): Promise<{ user: ExportUserRow; types: ExportTypeRow[]; collections: ExportCollectionRow[] } | null> {
  const [user, types, collections] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, locale: true } }),
    prisma.itemType.findMany({
      where: { userId, isSystem: false },
      select: { slug: true, name: true, icon: true, color: true, template: true },
      orderBy: { slug: "asc" },
    }),
    prisma.collection.findMany({
      where: { userId },
      select: { id: true, name: true, description: true, isFavorite: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return user ? { user, types, collections } : null;
}

const exportItemSelect = {
  id: true,
  title: true,
  description: true,
  contentType: true,
  content: true,
  url: true,
  language: true,
  isFavorite: true,
  isPinned: true,
  fileName: true,
  fileSize: true,
  fileUrl: true,
  createdAt: true,
  updatedAt: true,
  type: { select: { slug: true, isSystem: true } },
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
  collections: { select: { collectionId: true }, orderBy: { collectionId: "asc" } },
} as const;

/**
 * The user's items, a page at a time, by id. Each page is a fresh query filtered on the
 * owner and on `id > last`, so a page never holds more than `pageSize` rows.
 */
export async function* exportItemPages(userId: string, pageSize = EXPORT_PAGE_SIZE): AsyncGenerator<ExportItemRow[]> {
  let after: string | undefined;
  for (;;) {
    const rows = await prisma.item.findMany({
      where: { userId, ...(after !== undefined && { id: { gt: after } }) },
      orderBy: { id: "asc" },
      take: pageSize,
      select: exportItemSelect,
    });
    if (rows.length === 0) return;

    yield rows.map(({ tags, collections, ...row }) => ({
      ...row,
      tags: tags.map(({ tag }) => tag.name),
      collectionIds: collections.map(({ collectionId }) => collectionId),
    }));

    if (rows.length < pageSize) return;
    after = rows[rows.length - 1]!.id;
  }
}

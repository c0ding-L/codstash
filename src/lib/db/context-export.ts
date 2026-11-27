import type { ContextCollectionRow, ContextItemRow } from "@/lib/context-export";
import { prisma } from "@/lib/prisma";

/**
 * One of the user's collections and every item in it, for the context export. Null when the
 * collection is missing or someone else's: the caller answers 404 either way.
 */
export async function getCollectionContextData(
  userId: string,
  collectionId: string,
): Promise<{ collection: ContextCollectionRow; items: ContextItemRow[] } | null> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId, userId },
    select: { name: true, description: true },
  });
  if (!collection) return null;

  const items = await prisma.item.findMany({
    where: { userId, collections: { some: { collectionId } } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      url: true,
      language: true,
      fileName: true,
      fileSize: true,
      updatedAt: true,
      type: { select: { slug: true, name: true, isSystem: true } },
    },
  });
  return { collection, items };
}

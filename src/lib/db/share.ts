import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { tagNames, tagNameSelect } from "@/lib/db/item-links";
import { MAX_ITEM_LIMIT } from "@/lib/db/limits";
import { assertBelowCap } from "@/lib/db/user-lock";
import { prisma } from "@/lib/prisma";
import { containsSecrets } from "@/lib/secrets";
import { generateShareId, type ShareKind } from "@/lib/share";
import type { TypeRef } from "@/types/item-type";

// Public sharing (D1). Every write filters on the owner; every public read selects only what
// the page shows, never the owner's email, id or the item's collections.

/** A collection's or an item's share settings, as the share dialog shows them. */
export interface ShareSettings {
  /** Null while not shared. */
  shareId: string | null;
  indexable: boolean;
  showOwner: boolean;
}

/** What the share action needs to decide, per kind; null when it is not the user's. */
export interface ShareTarget extends ShareSettings {
  /** An item's `contentType`; always "text" for a collection. */
  contentType: string;
  /** The text items to scan for secrets: the item itself, or the collection's text items. */
  scanned: { title: string; description: string | null; content: string | null; url: string | null }[];
}

const SCAN_SELECT = { title: true, description: true, content: true, url: true } as const;
const SETTINGS_SELECT = { shareId: true, shareIndexable: true, shareShowOwner: true } as const;

export async function getShareTarget(userId: string, kind: ShareKind, id: string): Promise<ShareTarget | null> {
  if (kind === "item") {
    const item = await prisma.item.findFirst({
      where: { id, userId },
      select: { ...SETTINGS_SELECT, ...SCAN_SELECT, contentType: true },
    });
    if (!item) return null;
    const { shareId, shareIndexable, shareShowOwner, contentType, ...scan } = item;
    return { shareId, indexable: shareIndexable, showOwner: shareShowOwner, contentType, scanned: [scan] };
  }

  const collection = await prisma.collection.findFirst({ where: { id, userId }, select: SETTINGS_SELECT });
  if (!collection) return null;
  // File and image items are never on the public page, so they are not scanned either.
  const scanned = await prisma.item.findMany({
    where: { userId, contentType: "text", collections: { some: { collectionId: id } } },
    select: SCAN_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return {
    shareId: collection.shareId,
    indexable: collection.shareIndexable,
    showOwner: collection.shareShowOwner,
    contentType: "text",
    scanned,
  };
}

/** Public links the user has on, collections and items together: the Free cap counts both. */
export async function countShares(userId: string, db: Prisma.TransactionClient = prisma): Promise<number> {
  const [collections, items] = await Promise.all([
    db.collection.count({ where: { userId, shareId: { not: null } } }),
    db.item.count({ where: { userId, shareId: { not: null } } }),
  ]);
  return collections + items;
}

export interface ShareUpdate {
  /** The id to set; null turns sharing off. */
  shareId: string | null;
  indexable: boolean;
  showOwner: boolean;
}

/**
 * Writes the settings with raw SQL, so `updatedAt` stays as it was (sharing is not an edit).
 * `sharedAt` is set whenever a link is (re)made and kept when sharing goes off. Returns whether
 * the row was the user's.
 */
async function writeShare(db: Prisma.TransactionClient, userId: string, kind: ShareKind, id: string, update: ShareUpdate) {
  const { shareId, indexable, showOwner } = update;
  const updated =
    kind === "item"
      ? await db.$executeRaw`
          UPDATE "Item" SET "shareId" = ${shareId}, "shareIndexable" = ${indexable}, "shareShowOwner" = ${showOwner},
            "sharedAt" = CASE WHEN ${shareId}::text IS NOT NULL AND "shareId" IS DISTINCT FROM ${shareId}::text THEN NOW() ELSE "sharedAt" END
          WHERE "id" = ${id} AND "userId" = ${userId}
        `
      : await db.$executeRaw`
          UPDATE "Collection" SET "shareId" = ${shareId}, "shareIndexable" = ${indexable}, "shareShowOwner" = ${showOwner},
            "sharedAt" = CASE WHEN ${shareId}::text IS NOT NULL AND "shareId" IS DISTINCT FROM ${shareId}::text THEN NOW() ELSE "sharedAt" END
          WHERE "id" = ${id} AND "userId" = ${userId}
        `;
  return updated > 0;
}

/**
 * Saves the share settings. `newLink` asks for a fresh id (turning sharing on, or "Reset link");
 * otherwise the current one is kept. `maxShares` is the Free cap, re-counted under a lock on the
 * user row so parallel requests cannot all pass it; omitted for Pro, and not checked when the
 * target was already shared. Throws `LimitReachedError("shared")` at the cap.
 */
export async function saveShare(
  userId: string,
  kind: ShareKind,
  id: string,
  settings: { shared: boolean; indexable: boolean; showOwner: boolean; newLink: boolean; currentShareId: string | null },
  { maxShares }: { maxShares?: number } = {},
): Promise<{ found: boolean; shareId: string | null }> {
  const { shared, indexable, showOwner, newLink, currentShareId } = settings;
  const shareId = !shared ? null : newLink || !currentShareId ? generateShareId() : currentShareId;
  const update = { shareId, indexable, showOwner };

  const needsCap = shared && !currentShareId && maxShares !== undefined;
  const found = needsCap
    ? await prisma.$transaction(async (tx) => {
        await assertBelowCap(tx, userId, "shared", maxShares, () => countShares(userId, tx));
        return writeShare(tx, userId, kind, id, update);
      })
    : await writeShare(prisma, userId, kind, id, update);

  return { found, shareId: found ? shareId : null };
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** One item as a public page renders it. */
export interface SharedItem {
  /** Server-side only, as a React key: never rendered. */
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  language: string | null;
  updatedAt: Date;
  type: TypeRef;
  /** Tag names, sorted. */
  tags: string[];
}

/** The select of a public item: no `userId`, no collections, no file fields. */
const SHARED_ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  content: true,
  url: true,
  language: true,
  updatedAt: true,
  type: { select: { slug: true, name: true, icon: true, color: true, isSystem: true } },
  tags: tagNameSelect,
} as const;

/** The owner's display name only: never the email. */
const OWNER_SELECT = { user: { select: { name: true } } } as const;

type SelectedSharedItem = Omit<SharedItem, "tags"> & { tags: { tag: { name: string } }[] };

function toSharedItem({ tags, ...item }: SelectedSharedItem): SharedItem {
  return { ...item, tags: tagNames(tags) };
}

export interface SharedPageMeta {
  indexable: boolean;
  /** Set only when the owner opted in. */
  ownerName: string | null;
}

/**
 * A shared text item, or null when the id is unknown or revoked, the item is a file, or it now
 * looks like it holds a secret: the page answers the same 404 for all of them. Cached per
 * request, so the metadata and the page share one read.
 */
export const getSharedItem = cache(async (shareId: string): Promise<(SharedItem & SharedPageMeta) | null> => {
  const row = await prisma.item.findUnique({
    where: { shareId },
    select: { ...SHARED_ITEM_SELECT, contentType: true, shareIndexable: true, shareShowOwner: true, ...OWNER_SELECT },
  });
  if (!row) return null;
  const { shareIndexable, shareShowOwner, user, ...rest } = row;
  const { contentType, ...item } = rest;
  if (contentType !== "text" || containsSecrets(item)) return null;
  return {
    ...toSharedItem(item),
    indexable: shareIndexable,
    ownerName: shareShowOwner ? user.name : null,
  };
});

export interface SharedCollection extends SharedPageMeta {
  name: string;
  description: string | null;
  /** Text items, secrets left out by the page (`visibleSharedItems`). */
  items: SharedItem[];
}

/** A shared collection with its text items, up to the item ceiling; null when unknown or revoked. */
export const getSharedCollection = cache(async (shareId: string): Promise<SharedCollection | null> => {
  const row = await prisma.collection.findUnique({
    where: { shareId },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      shareIndexable: true,
      shareShowOwner: true,
      ...OWNER_SELECT,
    },
  });
  if (!row) return null;

  const items = await prisma.item.findMany({
    // The owner's own items only: links are always the owner's, this is a second guard.
    where: { userId: row.userId, contentType: "text", collections: { some: { collectionId: row.id } } },
    select: SHARED_ITEM_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: MAX_ITEM_LIMIT,
  });

  return {
    name: row.name,
    description: row.description,
    indexable: row.shareIndexable,
    ownerName: row.shareShowOwner ? row.user.name : null,
    items: items.map(toSharedItem),
  };
});

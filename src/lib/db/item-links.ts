// An item's tag and collection links: how they are selected, read back and written. Server-only.

/** Selects an item's tag names through the join. */
export const tagNameSelect = { select: { tag: { select: { name: true } } } } as const;

/** Sorts tag names in place and returns them. The one order every reader uses, so tags never reorder after a save. */
export function sortTagNames(names: string[]): string[] {
  return names.sort((a, b) => a.localeCompare(b));
}

/** The sorted names of an item's tag links, as `tagNameSelect` reads them. */
export function tagNames(links: { tag: { name: string } }[]): string[] {
  return sortTagNames(links.map(({ tag }) => tag.name));
}

/**
 * The tag links of an item, one per distinct name, each to this user's tag of
 * that name, created if they have none. A repeated name would link the same tag
 * twice, which the join's key forbids.
 */
export function tagLinks(userId: string, tags: string[]) {
  return [...new Set(tags)].map((name) => ({
    tag: {
      connectOrCreate: {
        where: { userId_name: { userId, name } },
        create: { name, userId },
      },
    },
  }));
}

/**
 * The links of an item to these collections, one per distinct id. The caller
 * checks the ids are the user's first: `connect` does not filter on the owner.
 */
export function collectionLinks(collectionIds: string[]) {
  return [...new Set(collectionIds)].map((id) => ({ collection: { connect: { id } } }));
}

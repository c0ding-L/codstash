/** Items per page on `/items/[type]` and `/collections/[id]`. */
export const ITEMS_PER_PAGE = 21;

/** Collections per page on `/collections`. Lower than the spec's 21: the cards are large. */
export const COLLECTIONS_PER_PAGE = 9;

/** Collection cards in the dashboard's "Recent collections" section. */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;

/** Rows in the dashboard's "Recent items" section. */
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;

/**
 * The page a `?page=` search param asks for, or null when it is not a valid page
 * number. No param means page 1. Only plain positive integers pass: `0`, `-1`,
 * `1.5`, `01`, `abc` and a repeated param (`?page=1&page=2`) are all rejected.
 */
export function parsePageParam(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;

  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : null;
}

/** How many pages `totalCount` rows fill. Always at least 1, so an empty list has a page 1. */
export function pageCount(totalCount: number, perPage: number): number {
  return Math.max(1, Math.ceil(totalCount / perPage));
}

/**
 * The rows a page skips: page 1 skips none. A page below 1 or a non-integer is a
 * caller bug and throws, rather than reaching Prisma as a negative `skip`.
 */
export function pageOffset(page: number, perPage: number): number {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError(`page must be a positive integer, received ${page}`);
  }

  return (page - 1) * perPage;
}

export type PageLink = number | "ellipsis";

/**
 * The page numbers to link, with gaps shown as `"ellipsis"`. Always shows the
 * first and last pages and one on each side of the current one; a gap of a
 * single page shows that page rather than an ellipsis.
 *
 * `pageLinks(6, 12)` → `[1, "ellipsis", 5, 6, 7, "ellipsis", 12]`.
 */
export function pageLinks(current: number, count: number): PageLink[] {
  const shown = new Set([1, count, current - 1, current, current + 1]);
  const pages = [...shown].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);

  const links: PageLink[] = [];
  for (const page of pages) {
    const previous = links.at(-1);
    if (typeof previous === "number" && page - previous === 2) links.push(previous + 1);
    else if (typeof previous === "number" && page - previous > 2) links.push("ellipsis");
    links.push(page);
  }

  return links;
}

/**
 * The page to go to after `removedId` left a paginated listing (deleted, or edited
 * out of it), or null to stay put. Only removing the one row of the last page
 * moves anything: that page no longer exists and would answer 404, so the user
 * steps back one page.
 */
export function pageAfterRemoval(
  page: number,
  pageCount: number,
  rowIds: readonly string[],
  removedId: string,
): number | null {
  const lastRowOfLastPage = page > 1 && page === pageCount && rowIds.length === 1 && rowIds[0] === removedId;
  return lastRowOfLastPage ? page - 1 : null;
}

/** The collection a `/collections/[id]` path shows, or null for any other path. */
export function collectionIdFromPath(pathname: string): string | null {
  const match = /^\/collections\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

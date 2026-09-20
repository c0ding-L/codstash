/** Ceilings for list reads. Well above today's data; they exist to bound a bad input. */
export const MAX_COLLECTION_LIMIT = 50;
export const MAX_ITEM_LIMIT = 100;

/**
 * Validates a row limit before it reaches a Prisma `take`. Prisma reads a
 * negative `take` as "count backwards", so an unchecked `-5` would silently flip
 * the order instead of failing.
 *
 * A non-integer or a value below 1 is a caller bug and throws; a value above
 * `max` is clamped to it.
 */
export function clampLimit(limit: number, max: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit must be a positive integer, received ${limit}`);
  }

  return Math.min(limit, max);
}

// Prisma's error codes, read off any thrown value. Kept apart from `@/lib/prisma`, which tests
// mock whole. Duck-typed on `code` rather than `instanceof`, so a plain `{ code }` counts too.

/** The Prisma error code of a thrown value, or undefined. */
export function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

/** P2025, "record to update/delete not found": also what a filter on another user's row gives. */
export function isPrismaNotFound(error: unknown): boolean {
  return prismaErrorCode(error) === "P2025";
}

/** P2002, a unique constraint failed. */
export function isUniqueViolation(error: unknown): boolean {
  return prismaErrorCode(error) === "P2002";
}

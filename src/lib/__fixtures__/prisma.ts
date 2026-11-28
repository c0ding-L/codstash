/** An error as Prisma throws it, with its code: the actions read `code`, not the class. */
export function prismaError(code: string) {
  return Object.assign(new Error(code), { code });
}

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires a driver adapter; `new PrismaClient()` on its own no longer
// connects. Runtime uses the Neon serverless driver, which suits Vercel's
// serverless functions. Migrations use @prisma/adapter-pg instead — see
// prisma.config.ts for why.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Next.js hot-reloads modules in development, which would otherwise open a new
// pool on every edit until the database refuses connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Smoke test for the database connection and schema.
 *
 * Run with: npm run db:test
 *
 * Read-only apart from one write round-trip, which runs inside a transaction
 * that is deliberately rolled back, so the database is left untouched.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

const ROLLBACK = "intentional rollback";

async function main() {
  console.log("→ connecting…");
  // Cast to text: these return PostgreSQL's `name` type, which the driver
  // adapter cannot deserialize (P2010, UnsupportedNativeDataType).
  const [{ db, usr }] = await prisma.$queryRaw<
    { db: string; usr: string }[]
  >`select current_database()::text as db, current_user::text as usr`;
  console.log(`  connected to "${db}" as "${usr}"`);

  console.log("\n→ row counts");
  const counts = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    sessions: await prisma.session.count(),
    itemTypes: await prisma.itemType.count(),
    collections: await prisma.collection.count(),
    items: await prisma.item.count(),
    tags: await prisma.tag.count(),
    itemTags: await prisma.itemTag.count(),
  };
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model.padEnd(12)} ${count}`);
  }

  console.log("\n→ write round-trip (rolled back)");
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `smoke-${Date.now()}@example.test`, name: "Smoke Test" },
      });
      const type = await tx.itemType.create({
        data: { slug: "snippet", name: "Snippet", isSystem: false, userId: user.id },
      });
      const collection = await tx.collection.create({
        data: { name: "Smoke Collection", userId: user.id },
      });
      const item = await tx.item.create({
        data: {
          title: "Smoke Item",
          userId: user.id,
          typeId: type.id,
          collectionId: collection.id,
        },
      });
      const tag = await tx.tag.create({ data: { name: "smoke", userId: user.id } });
      await tx.itemTag.create({ data: { itemId: item.id, tagId: tag.id } });

      const readBack = await tx.item.findUniqueOrThrow({
        where: { id: item.id },
        include: { type: true, collection: true, tags: { include: { tag: true } } },
      });
      console.log(
        `  created and read back "${readBack.title}" ` +
          `(type ${readBack.type.name}, collection ${readBack.collection?.name}, ` +
          `${readBack.tags.length} tag)`,
      );

      throw new Error(ROLLBACK);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
    console.log("  rolled back");
  }

  const usersAfter = await prisma.user.count();
  if (usersAfter !== counts.users) {
    throw new Error(
      `rollback failed: user count went from ${counts.users} to ${usersAfter}`,
    );
  }
  console.log("  verified: nothing persisted");

  console.log("\n✔ database OK");
}

main()
  .catch((error) => {
    console.error("\n✘ database check failed\n");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

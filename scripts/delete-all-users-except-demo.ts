/**
 * Deletes every user except demo@codstash.io, together with everything they
 * own: items, collections, tags, custom item types, accounts and sessions. The
 * demo user and all of their content are left untouched.
 *
 * Run with: npx tsx scripts/delete-all-users-except-demo.ts          (dry run)
 *           npx tsx scripts/delete-all-users-except-demo.ts --apply  (deletes)
 *
 * `dotenv/config` loads `.env`, which is the Neon `develop` branch. The script
 * prints the database host, and refuses to run if that host is the one in
 * `.env.production`. It also aborts when the demo user does not exist, so a
 * wrong database can never end up with every user deleted.
 *
 * This cannot be undone. Read the dry run before passing --apply.
 */
import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";

import { prisma } from "@/lib/prisma";

const KEEP_EMAIL = "demo@codstash.io";

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/** The host `.env.production` points at, read from the file; no connection is made. */
function productionHost() {
  if (!existsSync(".env.production")) return null;
  const line = readFileSync(".env.production", "utf8")
    .split("\n")
    .find((row) => row.startsWith("DATABASE_URL="));
  return hostOf(line?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, ""));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const host = hostOf(process.env.DATABASE_URL);

  console.log(`Database host: ${host ?? "unknown"}`);
  if (!host) throw new Error("DATABASE_URL is missing or not a valid URL.");
  if (host === productionHost()) {
    throw new Error("This is the production database host. Refusing to run.");
  }

  const keep = await prisma.user.findUnique({
    where: { email: KEEP_EMAIL },
    select: { id: true, _count: { select: { items: true, collections: true, tags: true, itemTypes: true } } },
  });
  if (!keep) throw new Error(`${KEEP_EMAIL} does not exist in this database. Aborting.`);

  const doomed = await prisma.user.findMany({
    where: { id: { not: keep.id } },
    select: {
      id: true,
      email: true,
      _count: { select: { items: true, collections: true, tags: true, itemTypes: true, accounts: true, sessions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Keeping ${KEEP_EMAIL}: ${JSON.stringify(keep._count)}`);
  console.log(`${doomed.length} user(s) to delete:`);
  for (const user of doomed) console.log(`  ${user.email.padEnd(32)} ${JSON.stringify(user._count)}`);

  if (!apply) {
    console.log("Dry run. Nothing deleted. Pass --apply to delete them.");
    return;
  }
  if (doomed.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = doomed.map((user) => user.id);
  // Items first: `Item.typeId` is `Restrict`, so a user's items must be gone
  // before their own custom item types are removed by the cascade.
  const [items, users, tokens] = await prisma.$transaction([
    prisma.item.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
    // Tokens are keyed by email, not by a relation, so they do not cascade.
    prisma.verificationToken.deleteMany({ where: { identifier: { not: KEEP_EMAIL } } }),
  ]);
  console.log(`Deleted ${users.count} user(s), ${items.count} item(s) and ${tokens.count} verification token(s).`);

  const after = await prisma.user.findUnique({
    where: { email: KEEP_EMAIL },
    select: { _count: { select: { items: true, collections: true, tags: true, itemTypes: true } } },
  });
  const unchanged = JSON.stringify(after?._count) === JSON.stringify(keep._count);
  console.log(`${KEEP_EMAIL} after: ${JSON.stringify(after?._count)} (${unchanged ? "unchanged" : "CHANGED"})`);
  console.log(`Users left: ${await prisma.user.count()}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * One-off: marks existing email/password accounts as verified, so they are not
 * locked out by the email-verification gate.
 *
 * Run with: npx tsx scripts/backfill-email-verified.ts          (dry run)
 *           npx tsx scripts/backfill-email-verified.ts --apply  (writes)
 *
 * `dotenv/config` loads `.env`, which is the Neon `develop` branch. This is a
 * script and not a migration on purpose: `prisma migrate deploy` would apply a
 * migration to production. It only touches rows with a password and no
 * `emailVerified`; GitHub-only users are not affected by the gate.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://unset").hostname;
  const where = { emailVerified: null, password: { not: null } };
  const apply = process.argv.includes("--apply");

  const rows = await prisma.user.findMany({ where, select: { email: true } });
  console.log(`Database host: ${host}`);
  console.log(`${rows.length} account(s) to mark verified:`);
  for (const row of rows) console.log(`  ${row.email}`);

  if (!apply) {
    console.log("Dry run. Nothing written. Pass --apply to update them.");
    return;
  }

  const { count } = await prisma.user.updateMany({ where, data: { emailVerified: new Date() } });
  console.log(`Updated ${count} account(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Deleting an account and everything in it. Server-only. Shared by Delete Account (/profile)
// and the admin panel.

import { getItemFileKeys } from "@/lib/db/items";
import { resetIdentifier, verificationIdentifier } from "@/lib/email-token";
import { prisma } from "@/lib/prisma";
import { deleteObjectsQuietly } from "@/lib/r2";

/** Deletes the user, their data and their email tokens, then their stored files. */
export async function deleteUserAndData(user: { id: string; email: string }) {
  const email = user.email.toLowerCase();
  // Read before the items go: the cascade would lose the R2 keys.
  const fileKeys = await getItemFileKeys(user.id);

  await prisma.$transaction([
    // Items first: `Item.typeId` is `Restrict`, and the user's custom types
    // are deleted by the same cascade as their items.
    prisma.item.deleteMany({ where: { userId: user.id } }),
    // No foreign key on tokens, so the cascade does not reach them.
    prisma.verificationToken.deleteMany({
      where: { identifier: { in: [verificationIdentifier(email), resetIdentifier(email)] } },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  await deleteObjectsQuietly(fileKeys);
}

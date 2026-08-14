import { Pin } from "lucide-react";
import { connection } from "next/server";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { getDemoUserId } from "@/lib/db/collections";
import { getPinnedItems } from "@/lib/db/items";

export async function PinnedItems() {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const userId = await getDemoUserId();
  const items = await getPinnedItems(userId);

  // The spec asks for nothing at all when nothing is pinned — heading included,
  // replacing the "Nothing pinned yet." placeholder this used to render.
  if (items.length === 0) return null;

  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Pin className="size-4 text-muted-foreground" aria-hidden />
        Pinned items
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

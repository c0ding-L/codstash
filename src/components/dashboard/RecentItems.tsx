import { Clock } from "lucide-react";
import { connection } from "next/server";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { getDemoUserId } from "@/lib/db/collections";
import { getRecentItems } from "@/lib/db/items";

export async function RecentItems() {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const userId = await getDemoUserId();
  const { items, totalCount } = await getRecentItems(userId);
  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          Recent items
        </h2>
        <span className="text-sm text-muted-foreground">
          {items.length} of {totalCount}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

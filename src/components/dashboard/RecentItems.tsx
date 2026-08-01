import { Clock } from "lucide-react";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { items } from "@/lib/mock-data";

const RECENT_ITEM_COUNT = 10;

// Copied before sorting: `items` is a shared module-level export.
const recentItems = [...items]
  .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  .slice(0, RECENT_ITEM_COUNT);

export function RecentItems() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          Recent items
        </h2>
        <span className="text-sm text-muted-foreground">
          {recentItems.length} of {items.length}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {recentItems.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

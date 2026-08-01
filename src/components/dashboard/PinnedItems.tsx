import { Pin } from "lucide-react";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { items } from "@/lib/mock-data";

const pinnedItems = items.filter((item) => item.isPinned);

export function PinnedItems() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Pin className="size-4 text-muted-foreground" aria-hidden />
        Pinned items
      </h2>

      {pinnedItems.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {pinnedItems.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing pinned yet.
        </p>
      )}
    </section>
  );
}

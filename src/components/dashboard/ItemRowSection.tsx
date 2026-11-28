import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ItemRow } from "@/components/dashboard/ItemRow";
import type { DashboardItem } from "@/lib/db/items";

interface ItemRowSectionProps {
  icon: LucideIcon;
  title: string;
  items: DashboardItem[];
  /** Beside the heading, e.g. a count. */
  aside?: ReactNode;
  /** Shown instead of the list when there are no items. */
  empty?: ReactNode;
}

/** A dashboard section: a heading with its icon over a list of item rows. Each section reads its own items. */
export function ItemRowSection({ icon: Icon, title, items, aside, empty }: ItemRowSectionProps) {
  const now = new Date().toISOString();
  const heading = (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {title}
    </h2>
  );

  return (
    <section className="flex flex-col gap-3">
      {aside ? <div className="flex items-baseline justify-between">{heading}{aside}</div> : heading}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      ) : (
        empty
      )}
    </section>
  );
}

import { Folder, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { SharedBadge } from "@/components/share/SharedBadge";
import type { RecentCollection } from "@/lib/db/collections";
import type { DashboardItem } from "@/lib/db/items";
import { useRelativeTime, useTypeView } from "@/i18n/labels";
import { colorClasses } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken } from "@/types/item-type";

/** One dense, editor-style row: icon, title, type badge, date. */
const ROW_CLASS =
  "relative flex h-8 items-center gap-2.5 px-2 font-mono text-[0.8rem] transition-colors hover:bg-muted/60";

/** A titled block of rows with its count, like a file explorer group. */
export function FavoritesSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="flex items-baseline gap-2 border-b border-border px-2 pb-1.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
        <span className="tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function RowIcon({ icon, color }: { icon: LucideIcon | null; color: ColorToken | null }) {
  const Icon = icon ?? Folder;
  return (
    <Icon
      className={cn("size-3.5 shrink-0", color ? colorClasses[color] : "text-muted-foreground")}
      aria-hidden
    />
  );
}

function TypeBadge({ label, color }: { label: string; color: ColorToken | null }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border border-border px-1.5 text-[0.7rem] leading-4 lowercase",
        color ? colorClasses[color] : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function RowDate({ date, now }: { date: Date; now: string }) {
  const relativeTime = useRelativeTime();
  return (
    <time
      dateTime={date.toISOString()}
      className="w-16 shrink-0 text-right text-[0.7rem] whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {relativeTime(date.toISOString(), now)}
    </time>
  );
}

/** Opens the item in the layout's drawer; the trigger covers the row. */
export function FavoriteItemRow({ item, now }: { item: DashboardItem; now: string }) {
  const typeView = useTypeView();
  const { Icon, color, label } = typeView(item.type);

  return (
    <li className={ROW_CLASS}>
      <ItemDrawerTrigger item={item} />
      <RowIcon icon={Icon} color={color} />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {item.isShared ? <SharedBadge /> : null}
      <TypeBadge label={label} color={color} />
      <RowDate date={item.updatedAt} now={now} />
    </li>
  );
}

/** Links to the collection; its icon and badge come from its most used type. */
export function FavoriteCollectionRow({ collection, now }: { collection: RecentCollection; now: string }) {
  const t = useTranslations();
  const typeView = useTypeView();
  // The types come sorted by count, so the first is the most used.
  const primary = collection.types[0] ? typeView(collection.types[0]) : null;
  const color = primary?.color ?? null;

  return (
    <li>
      <Link
        href={`/collections/${collection.id}`}
        className={cn(ROW_CLASS, "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
      >
        <RowIcon icon={primary?.Icon ?? null} color={color} />
        <span className="min-w-0 flex-1 truncate">{collection.name}</span>
        {collection.isShared ? <SharedBadge /> : null}
        <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
          {t("common.itemCount", { count: collection.itemCount })}
        </span>
        <TypeBadge label={primary?.label ?? t("favorites.emptyCollection")} color={color} />
        <RowDate date={collection.updatedAt} now={now} />
      </Link>
    </li>
  );
}

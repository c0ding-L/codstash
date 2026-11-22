import { Folder } from "lucide-react";
import Link from "next/link";

import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import type { RecentCollection } from "@/lib/db/collections";
import type { DashboardItem } from "@/lib/db/items";
import { formatRelativeTime } from "@/lib/format";
import { colorClasses, primaryTypeOf, toColorToken, toItemTypeSlug, typeIcons } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

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

function RowIcon({ slug, color }: { slug: ItemTypeSlug | null; color: ColorToken | null }) {
  const Icon = slug ? typeIcons[slug] : Folder;
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
  return (
    <time
      dateTime={date.toISOString()}
      className="w-16 shrink-0 text-right text-[0.7rem] whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {formatRelativeTime(date.toISOString(), now)}
    </time>
  );
}

/** Opens the item in the layout's drawer; the trigger covers the row. */
export function FavoriteItemRow({ item, now }: { item: DashboardItem; now: string }) {
  const slug = toItemTypeSlug(item.type.slug);
  const color = toColorToken(item.type.color);

  return (
    <li className={ROW_CLASS}>
      <ItemDrawerTrigger item={item} />
      <RowIcon slug={slug} color={color} />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <TypeBadge label={item.type.name} color={color} />
      <RowDate date={item.updatedAt} now={now} />
    </li>
  );
}

/** Links to the collection; its icon and badge come from its most used type. */
export function FavoriteCollectionRow({ collection, now }: { collection: RecentCollection; now: string }) {
  const primary = primaryTypeOf(collection);
  const color = primary?.color ?? null;

  return (
    <li>
      <Link
        href={`/collections/${collection.id}`}
        className={cn(ROW_CLASS, "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
      >
        <RowIcon slug={primary?.slug ?? null} color={color} />
        <span className="min-w-0 flex-1 truncate">{collection.name}</span>
        <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
          {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
        </span>
        <TypeBadge label={primary?.name ?? "empty"} color={color} />
        <RowDate date={collection.updatedAt} now={now} />
      </Link>
    </li>
  );
}

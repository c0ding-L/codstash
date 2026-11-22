import { Pin } from "lucide-react";

import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { Card, CardContent } from "@/components/ui/card";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import type { DashboardItem } from "@/lib/db/items";
import { formatCollectionNames, formatFileSize, formatRelativeTime } from "@/lib/format";
import { ringClasses, toColorToken, toItemTypeSlug, washClasses } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: DashboardItem;
  /** Passed in so every card on a page measures against the same moment. */
  now: string;
}

export function ItemCard({ item, now }: ItemCardProps) {
  const collectionNames = formatCollectionNames(item.collections);
  const slug = toItemTypeSlug(item.type.slug);
  const color = toColorToken(item.type.color);

  return (
    <Card className={cn("relative h-full transition-shadow", color && ringClasses[color])}>
      {/* Its own layer, as in RecentCollections: the tint sits over `bg-card`. */}
      {color ? (
        <span
          className={cn("pointer-events-none absolute inset-0", washClasses[color])}
          aria-hidden
        />
      ) : null}

      <ItemDrawerTrigger item={item} />

      <CardContent className="relative flex h-full items-start gap-3">
        <TypeIconTile slug={slug} color={color} className="size-9 shrink-0 rounded-lg" iconClassName="size-4" />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-medium">{item.title}</h2>
            {item.isPinned ? (
              <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
            ) : null}
          </div>

          {item.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-xs text-muted-foreground">
            {collectionNames ? <span>{collectionNames}</span> : null}
            {item.fileSize ? <span>{formatFileSize(item.fileSize)}</span> : null}
            <span>{formatRelativeTime(item.updatedAt.toISOString(), now)}</span>
          </div>
        </div>

        <FavoriteButton
          kind="item"
          id={item.id}
          name={item.title}
          isFavorite={item.isFavorite}
          className="-mt-1 -mr-2 shrink-0"
        />
      </CardContent>
    </Card>
  );
}

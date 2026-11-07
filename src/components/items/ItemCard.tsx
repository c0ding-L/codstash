import { Clock, Pin, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardItem } from "@/lib/db/items";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import {
  colorClasses,
  ringClasses,
  surfaceClasses,
  toColorToken,
  toItemTypeSlug,
  typeIcons,
  washClasses,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: DashboardItem;
  /** Passed in so every card on a page measures against the same moment. */
  now: string;
}

export function ItemCard({ item, now }: ItemCardProps) {
  const slug = toItemTypeSlug(item.type.slug);
  const color = toColorToken(item.type.color);
  const Icon = slug ? typeIcons[slug] : Clock;

  return (
    <Card className={cn("relative h-full transition-shadow", color && ringClasses[color])}>
      {/* Its own layer, as in RecentCollections: the tint sits over `bg-card`. */}
      {color ? (
        <span
          className={cn("pointer-events-none absolute inset-0", washClasses[color])}
          aria-hidden
        />
      ) : null}

      <CardContent className="relative flex h-full items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            color ? surfaceClasses[color] : "bg-muted",
          )}
        >
          <Icon className={cn("size-4", color && colorClasses[color])} aria-hidden />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-medium">{item.title}</h2>
            {item.isPinned ? (
              <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
            ) : null}
            {item.isFavorite ? (
              <Star
                className="size-3 shrink-0 fill-amber-400 text-amber-400"
                aria-label="Favorite"
              />
            ) : null}
          </div>

          {item.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-xs text-muted-foreground">
            {item.collectionName ? <span>{item.collectionName}</span> : null}
            {item.fileSize ? <span>{formatFileSize(item.fileSize)}</span> : null}
            <span>{formatRelativeTime(item.updatedAt.toISOString(), now)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

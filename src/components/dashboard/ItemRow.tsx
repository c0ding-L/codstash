import { Clock, Pin, Star } from "lucide-react";

import type { DashboardItem } from "@/lib/db/items";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import {
  colorClasses,
  surfaceClasses,
  toColorToken,
  toItemTypeSlug,
  typeIcons,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

/** `now` is passed in so labels measure against the wall clock, not MOCK_NOW. */
export function ItemRow({ item, now }: { item: DashboardItem; now: string }) {
  const slug = toItemTypeSlug(item.type.slug);
  const color = toColorToken(item.type.color);
  const Icon = slug ? typeIcons[slug] : Clock;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          color ? surfaceClasses[color] : "bg-muted",
        )}
      >
        <Icon className={cn("size-4", color && colorClasses[color])} aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
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
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={cn(color && colorClasses[color])}>{item.type.name}</span>
          {item.collectionName ? <span>· {item.collectionName}</span> : null}
          {item.fileSize ? <span>· {formatFileSize(item.fileSize)}</span> : null}
        </div>
      </div>

      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(item.updatedAt.toISOString(), now)}
      </span>
    </li>
  );
}

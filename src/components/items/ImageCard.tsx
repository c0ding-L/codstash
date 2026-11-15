import { Pin, Star } from "lucide-react";

import { ImageCardBody } from "@/components/items/ImageCardBody";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { Card } from "@/components/ui/card";
import type { DashboardItem } from "@/lib/db/items";
import { formatRelativeTime } from "@/lib/format";

interface ImageCardProps {
  item: DashboardItem;
  /** Passed in so every card on a page measures against the same moment. */
  now: string;
}

/** The gallery card for an image item: its thumbnail, then its title and details. */
export function ImageCard({ item, now }: ImageCardProps) {
  // Served by the app from the private bucket, for the owner only.
  const src = `/api/items/${encodeURIComponent(item.id)}/download`;

  return (
    <Card className="relative h-full pt-0">
      <ItemDrawerTrigger item={item} />

      <ImageCardBody
        src={src}
        alt={item.title}
        time={formatRelativeTime(item.updatedAt.toISOString(), now)}
        description={item.description}
        heading={
          <>
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
          </>
        }
      />
    </Card>
  );
}

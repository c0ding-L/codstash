import { Pin } from "lucide-react";

import { FavoriteButton } from "@/components/favorites/FavoriteButton";
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
      {/* Over the thumbnail's corner, on a backdrop so it reads on any image. */}
      <FavoriteButton
        kind="item"
        id={item.id}
        name={item.title}
        isFavorite={item.isFavorite}
        size="icon-sm"
        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
      />

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
          </>
        }
      />
    </Card>
  );
}

import { Pin, Star } from "lucide-react";

import { ImageThumbnail } from "@/components/items/ImageThumbnail";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardItem } from "@/lib/db/items";

/** The gallery card for an image item: its thumbnail, then its title. */
export function ImageCard({ item }: { item: DashboardItem }) {
  // Served by the app from the private bucket, for the owner only.
  const src = `/api/items/${encodeURIComponent(item.id)}/download`;

  return (
    <Card className="relative h-full pt-0">
      <ImageThumbnail src={src} alt={item.title} />

      <ItemDrawerTrigger item={item} />

      <CardContent className="flex items-center gap-1.5">
        <h2 className="truncate font-medium">{item.title}</h2>
        {item.isPinned ? (
          <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
        ) : null}
        {item.isFavorite ? (
          <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />
        ) : null}
      </CardContent>
    </Card>
  );
}

import { Pin, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { SharedBadge } from "@/components/share/SharedBadge";
import { cn } from "@/lib/utils";

interface ItemStatusMarkersProps {
  item: { isShared?: boolean; isPinned: boolean; isFavorite: boolean };
  /** Off where the item cannot be shared (files, images). */
  showShared?: boolean;
  /** Off where a Favorite button stands in for the star. */
  showFavorite?: boolean;
  /** Added to each marker, e.g. `mt-1` beside a heading that wraps. */
  className?: string;
}

/**
 * The small markers after an item's name: its public link, pinned, favorite. No `"use client"`:
 * the lists that show them are server components.
 */
export function ItemStatusMarkers({ item, showShared = true, showFavorite = true, className }: ItemStatusMarkersProps) {
  const t = useTranslations("common");
  return (
    <>
      {showShared && item.isShared ? <SharedBadge className={className} /> : null}
      {item.isPinned ? (
        <Pin className={cn("size-3 shrink-0 text-muted-foreground", className)} aria-label={t("pinned")} />
      ) : null}
      {showFavorite && item.isFavorite ? (
        <Star className={cn("size-3 shrink-0 fill-amber-400 text-amber-400", className)} aria-label={t("favorite")} />
      ) : null}
    </>
  );
}

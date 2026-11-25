"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useFavoriteToggle, type FavoriteKind } from "@/hooks/use-favorite-toggle";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  kind: FavoriteKind;
  id: string;
  /** The item's title or the collection's name, for the accessible name. */
  name: string;
  isFavorite: boolean;
  size?: "icon-xs" | "icon-sm" | "icon";
  className?: string;
}

/**
 * A star that toggles the favorite. On a card it sits above the card's overlay
 * (`z-20` over `z-10`), so clicking it neither opens the drawer nor follows the link.
 */
export function FavoriteButton({ kind, id, name, isFavorite, size = "icon-xs", className }: FavoriteButtonProps) {
  const t = useTranslations("favorites");
  const favorite = useFavoriteToggle(kind, id, isFavorite);

  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={t("favoriteName", { name })}
      aria-pressed={favorite.isFavorite}
      title={favorite.isFavorite ? t("remove") : t("add")}
      disabled={favorite.pending}
      onClick={favorite.toggle}
      className={cn("relative z-20 text-muted-foreground disabled:opacity-100", className)}
    >
      <Star aria-hidden className={cn(favorite.isFavorite && "fill-amber-400 text-amber-400")} />
    </Button>
  );
}

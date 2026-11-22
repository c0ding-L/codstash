"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setCollectionFavorite } from "@/actions/collections";
import { setItemFavorite } from "@/actions/items";

export type FavoriteKind = "item" | "collection";

/**
 * Toggles an item's or a collection's favorite. The star flips at once and flips
 * back if the action fails. The action revalidates the layout, and the refreshed
 * page lands in the same transition, so the new prop takes over with no flicker.
 * `onChanged` is for state the refresh does not reach, such as the drawer's card.
 */
export function useFavoriteToggle(
  kind: FavoriteKind,
  id: string,
  isFavorite: boolean,
  onChanged?: (isFavorite: boolean) => void,
) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    const next = !optimistic;

    startTransition(async () => {
      setOptimistic(next);
      const result = kind === "item" ? await setItemFavorite(id, next) : await setCollectionFavorite(id, next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onChanged?.(next);
    });
  }

  return { isFavorite: optimistic, pending, toggle };
}

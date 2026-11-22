"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setItemPinned } from "@/actions/items";

/**
 * Pins or unpins an item, like `useFavoriteToggle`: the pin flips at once and flips
 * back if the action fails. Toasts either way. `onChanged` is for state the page
 * refresh does not reach, such as the drawer's card.
 */
export function usePinToggle(id: string, isPinned: boolean, onChanged?: (isPinned: boolean) => void) {
  const [optimistic, setOptimistic] = useOptimistic(isPinned);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    const next = !optimistic;

    startTransition(async () => {
      setOptimistic(next);
      const result = await setItemPinned(id, next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Item pinned" : "Item unpinned");
      onChanged?.(next);
    });
  }

  return { isPinned: optimistic, pending, toggle };
}

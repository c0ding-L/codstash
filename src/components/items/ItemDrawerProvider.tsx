"use client";

import type { Dialog } from "@base-ui/react/dialog";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { ItemDetails, type ItemDetailState } from "@/components/items/ItemDetails";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";

type OpenItem = (item: DashboardItem) => void;

const OpenItemContext = createContext<OpenItem | null>(null);

export function useOpenItemDrawer() {
  const openItem = useContext(OpenItemContext);
  if (!openItem) throw new Error("useOpenItemDrawer must be used inside ItemDrawerProvider.");
  return openItem;
}

/**
 * Holds the drawer and its state for the server-rendered items beneath it. The
 * clicked card's data shows at once, and only the rest waits for the fetch.
 */
export function ItemDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<DashboardItem | null>(null);
  const [detail, setDetail] = useState<ItemDetailState>({ status: "loading" });
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const openItem = useCallback<OpenItem>(async (item) => {
    // Only the latest request may fill the drawer.
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    setCard(item);
    setDetail({ status: "loading" });
    setOpen(true);

    try {
      const response = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Item request failed with ${response.status}.`);

      const fetched: ItemDetailJson = await response.json();
      if (!controller.signal.aborted) setDetail({ status: "ready", detail: fetched });
    } catch {
      if (!controller.signal.aborted) setDetail({ status: "error" });
    }
  }, []);

  function handleOpenChange(next: boolean, details: Dialog.Root.ChangeEventDetails) {
    // The second click of a double click on a card lands on the backdrop the
    // first one just opened. `detail` counts the clicks, so a single click on
    // the backdrop still closes the drawer.
    if (!next && details.reason === "outside-press" && details.event.detail > 1) {
      details.cancel();
      return;
    }

    setOpen(next);
    if (!next) request.current?.abort();
  }

  return (
    <OpenItemContext.Provider value={openItem}>
      {children}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {card ? (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="text-lg font-semibold">{card.title}</SheetTitle>
              </SheetHeader>
              <ItemDetails card={card} state={detail} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </OpenItemContext.Provider>
  );
}

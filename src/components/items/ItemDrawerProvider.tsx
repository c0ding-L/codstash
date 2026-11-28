"use client";

import type { Dialog } from "@base-ui/react/dialog";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { ItemDetails, type ItemDetailState } from "@/components/items/ItemDetails";
import type { SavedItem } from "@/components/items/ItemEditForm";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { DashboardItem } from "@/lib/db/items";
import { fetchItemDetail } from "@/lib/item-client";
import { markUsed } from "@/lib/item-usage";

type OpenItem = (item: DashboardItem) => void;

const OpenItemContext = createContext<OpenItem | null>(null);

export function useOpenItemDrawer() {
  const openItem = useContext(OpenItemContext);
  if (!openItem) throw new Error("useOpenItemDrawer must be used inside ItemDrawerProvider.");
  return openItem;
}

/**
 * Holds the drawer and its state for every signed-in page. It sits in the app
 * layout, so the command palette in the top bar can open an item too. The
 * clicked card's data shows at once, and only the rest waits for the fetch.
 */
export function ItemDrawerProvider({
  aiAllowed,
  children,
}: {
  /** From the server's plan check, for the edit form's Suggest Tags button. */
  aiAllowed: Promise<boolean>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // The layout outlives a navigation, so the drawer closes itself when the page
  // changes, e.g. after following a collection link inside it. Adjusted while
  // rendering rather than in an effect, so the old page never shows it open.
  const pathname = usePathname();
  const [shownOn, setShownOn] = useState(pathname);
  if (pathname !== shownOn) {
    setShownOn(pathname);
    setOpen(false);
  }
  const [card, setCard] = useState<DashboardItem | null>(null);
  const [detail, setDetail] = useState<ItemDetailState>({ status: "loading" });
  // Bumped on every open, so the details remount and never reopen in edit mode.
  const [openCount, setOpenCount] = useState(0);
  const request = useRef<AbortController | null>(null);
  // The item on show now: a save that finishes after another item opened is dropped.
  const currentId = useRef<string | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const openItem = useCallback<OpenItem>(async (item) => {
    // Only the latest request may fill the drawer.
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    currentId.current = item.id;
    setCard(item);
    setDetail({ status: "loading" });
    setOpenCount((count) => count + 1);
    setOpen(true);
    // Once per opening (A5); the server throttles repeated openings to one write per 5 minutes.
    markUsed(item.id);

    try {
      const fetched = await fetchItemDetail(item.id, { signal: controller.signal });
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

  // The saved item replaces both halves, so the drawer shows it without a refetch.
  const handleSaved = useCallback(({ card: saved, detail: savedDetail }: SavedItem) => {
    if (saved.id !== currentId.current) return;
    setCard(saved);
    setDetail({ status: "ready", detail: savedDetail });
  }, []);

  // Like a save: a favorite that lands after another item opened is dropped.
  const handleFavoriteChanged = useCallback((itemId: string, isFavorite: boolean) => {
    if (itemId !== currentId.current) return;
    setCard((current) => (current?.id === itemId ? { ...current, isFavorite } : current));
  }, []);

  const handlePinnedChanged = useCallback((itemId: string, isPinned: boolean) => {
    if (itemId !== currentId.current) return;
    setCard((current) => (current?.id === itemId ? { ...current, isPinned } : current));
  }, []);

  // A delete that finishes after another item opened leaves the drawer alone.
  const handleDeleted = useCallback((itemId: string) => {
    if (itemId !== currentId.current) return;
    request.current?.abort();
    setOpen(false);
  }, []);

  return (
    <OpenItemContext.Provider value={openItem}>
      {children}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {card ? (
            <ItemDetails
              key={openCount}
              card={card}
              state={detail}
              aiAllowed={aiAllowed}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onFavoriteChanged={handleFavoriteChanged}
              onPinnedChanged={handlePinnedChanged}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </OpenItemContext.Provider>
  );
}

"use client";

import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog, type EditableCollection } from "@/components/collections/EditCollectionDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { cn } from "@/lib/utils";

interface CollectionCardMenuProps {
  collection: EditableCollection & { isFavorite: boolean };
}

/**
 * The card's `⋯` menu. It sits above the card's link overlay (`z-20` over `z-10`), so
 * opening it does not navigate. The dialogs live beside the menu, not in it: the menu's
 * popup unmounts when it closes and would take them with it.
 */
export function CollectionCardMenu({ collection }: CollectionCardMenuProps) {
  const t = useTranslations();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const favorite = useFavoriteToggle("collection", collection.id, collection.isFavorite);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-20 -mt-1 -mr-2 text-muted-foreground"
              aria-label={t("collections.actionsFor", { name: collection.name })}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={favorite.pending} onClick={favorite.toggle}>
            <Star aria-hidden className={cn(favorite.isFavorite && "fill-amber-400 text-amber-400")} />
            {favorite.isFavorite ? t("favorites.remove") : t("favorites.add")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCollectionDialog collection={collection} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteCollectionDialog collection={collection} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

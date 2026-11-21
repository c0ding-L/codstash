"use client";

import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-20 -mt-1 -mr-2 text-muted-foreground"
              aria-label={`Actions for ${collection.name}`}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          {/* Placeholder: favoriting is not wired up yet. */}
          <DropdownMenuItem>
            <Star aria-hidden className={cn(collection.isFavorite && "fill-amber-400 text-amber-400")} />
            Favorite
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCollectionDialog collection={collection} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteCollectionDialog collection={collection} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog } from "@/components/collections/EditCollectionDialog";
import { Button } from "@/components/ui/button";
import type { CollectionSummary } from "@/lib/db/collections";
import { cn } from "@/lib/utils";

/** Edit, favorite and delete buttons in a collection page's header. */
export function CollectionHeaderActions({ collection }: { collection: CollectionSummary }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Placeholder: favoriting is not wired up yet. */}
      <Button variant="ghost" size="icon" aria-label="Favorite">
        <Star aria-hidden className={cn(collection.isFavorite && "fill-amber-400 text-amber-400")} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Edit collection" onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete collection"
        className="text-destructive hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>

      <EditCollectionDialog collection={collection} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectToList
      />
    </div>
  );
}

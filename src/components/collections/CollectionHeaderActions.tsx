"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog } from "@/components/collections/EditCollectionDialog";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { Button } from "@/components/ui/button";
import type { CollectionSummary } from "@/lib/db/collections";

/** Edit, favorite and delete buttons in a collection page's header. */
export function CollectionHeaderActions({ collection }: { collection: CollectionSummary }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const t = useTranslations("collections");

  return (
    <div className="flex shrink-0 items-center gap-1">
      <FavoriteButton
        kind="collection"
        id={collection.id}
        name={collection.name}
        isFavorite={collection.isFavorite}
        size="icon"
        className="text-foreground"
      />
      <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("deleteLabel")}
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

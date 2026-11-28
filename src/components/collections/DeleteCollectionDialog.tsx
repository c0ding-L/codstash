"use client";

import { useTranslations } from "next-intl";

import { deleteCollection } from "@/actions/collections";
import { DestructiveConfirmDialog, emphasizeName } from "@/components/DestructiveConfirmDialog";
import { useRefreshAfterRemoval } from "@/hooks/use-refresh-after-removal";

interface DeleteCollectionDialogProps {
  collection: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set on the collection's own page: the action then redirects to `/collections`. */
  redirectToList?: boolean;
}

/** Asks before deleting the collection. On failure it stays open, so the user can retry or cancel. */
export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  redirectToList = false,
}: DeleteCollectionDialogProps) {
  const t = useTranslations("collections.delete");
  const refreshAfterRemoval = useRefreshAfterRemoval();

  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      body={t.rich("body", { collection: collection.name, name: emphasizeName })}
      // With `redirectToList` a success never returns here: the action redirects.
      action={() => deleteCollection(collection.id, { redirectToList })}
      successMessage={t("deleted")}
      onSuccess={() => refreshAfterRemoval(collection.id)}
    />
  );
}

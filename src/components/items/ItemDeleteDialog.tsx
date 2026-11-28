"use client";

import { useTranslations } from "next-intl";

import { deleteItem } from "@/actions/items";
import { DestructiveConfirmDialog, emphasizeName } from "@/components/DestructiveConfirmDialog";
import { useRefreshAfterRemoval } from "@/hooks/use-refresh-after-removal";
import type { DashboardItem } from "@/lib/db/items";

interface ItemDeleteDialogProps {
  card: DashboardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (itemId: string) => void;
}

/** Asks before deleting the item. On failure it stays open, so the user can retry or cancel. */
export function ItemDeleteDialog({ card, open, onOpenChange, onDeleted }: ItemDeleteDialogProps) {
  const t = useTranslations("drawer.delete");
  const refreshAfterRemoval = useRefreshAfterRemoval();

  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      body={t.rich("body", { title: card.title, name: emphasizeName })}
      action={() => deleteItem(card.id)}
      successMessage={t("deleted")}
      onSuccess={() => {
        onDeleted(card.id);
        refreshAfterRemoval(card.id);
      }}
    />
  );
}

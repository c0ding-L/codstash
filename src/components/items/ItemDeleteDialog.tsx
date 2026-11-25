"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteItem } from "@/actions/items";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  const tc = useTranslations("common");
  const refreshAfterRemoval = useRefreshAfterRemoval();
  const [pending, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      const result = await deleteItem(card.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(t("deleted"));
      onOpenChange(false);
      onDeleted(card.id);
      refreshAfterRemoval(card.id);
    });
  }

  return (
    // Escape and Cancel do nothing while the delete runs: its outcome must still show.
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <TriangleAlert aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich("body", {
              title: card.title,
              name: (chunks) => <span className="font-medium break-words text-foreground">{chunks}</span>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          {/* Solid red: the `destructive` variant is only a tint, too quiet for a delete that cannot be undone. */}
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? tc("deleting") : tc("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

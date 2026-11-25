"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteCollection } from "@/actions/collections";
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
  const tc = useTranslations("common");
  const refreshAfterRemoval = useRefreshAfterRemoval();
  const [pending, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      // With `redirectToList` a success never returns here: the action redirects.
      const result = await deleteCollection(collection.id, { redirectToList });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(t("deleted"));
      onOpenChange(false);
      refreshAfterRemoval(collection.id);
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
              collection: collection.name,
              name: (chunks) => <span className="font-medium break-words text-foreground">{chunks}</span>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          {/* Solid red, like the item delete: the `destructive` variant is only a tint. */}
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

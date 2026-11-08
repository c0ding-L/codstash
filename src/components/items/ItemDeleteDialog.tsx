"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
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
import type { DashboardItem } from "@/lib/db/items";

interface ItemDeleteDialogProps {
  card: DashboardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (itemId: string) => void;
}

/** Asks before deleting the item. On failure it stays open, so the user can retry or cancel. */
export function ItemDeleteDialog({ card, open, onOpenChange, onDeleted }: ItemDeleteDialogProps) {
  const router = useRouter();
  const [pending, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      const result = await deleteItem(card.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Item deleted.");
      onOpenChange(false);
      onDeleted(card.id);
      router.refresh();
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
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium break-words text-foreground">{card.title}</span> will be deleted for
            good. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* Solid red: the `destructive` variant is only a tint, too quiet for a delete that cannot be undone. */}
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

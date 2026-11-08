"use client";

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
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium break-words text-foreground">{card.title}</span> will be deleted for
            good. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

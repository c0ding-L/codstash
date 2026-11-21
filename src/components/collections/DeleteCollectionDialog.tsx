"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [pending, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      // With `redirectToList` a success never returns here: the action redirects.
      const result = await deleteCollection(collection.id, { redirectToList });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Collection deleted.");
      onOpenChange(false);
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
          <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium break-words text-foreground">{collection.name}</span> will be deleted.
            Its items are kept; they just leave this collection. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* Solid red, like the item delete: the `destructive` variant is only a tint. */}
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

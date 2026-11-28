"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

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

interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  /** Defaults to Delete / Deleting. */
  confirmLabel?: string;
  pendingLabel?: string;
  /** The action to run. A failure shows its error and leaves the dialog open, to retry or cancel. */
  action: () => Promise<{ success: boolean; error: string | null }>;
  successMessage: string;
  /** After a success, once the dialog has closed. */
  onSuccess: () => void;
}

/** The emphasis on the name in a confirm dialog's body: `t.rich(…, { name: emphasizeName })`. */
export function emphasizeName(chunks: ReactNode) {
  return <span className="font-medium break-words text-foreground">{chunks}</span>;
}

/** Asks before something that cannot be undone: a delete or a revoke. */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  pendingLabel,
  action,
  successMessage,
  onSuccess,
}: DestructiveConfirmDialogProps) {
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    // Escape and Cancel do nothing while the action runs: its outcome must still show.
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <TriangleAlert aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          {/* Solid red: the `destructive` variant is only a tint, too quiet for what cannot be undone. */}
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? (pendingLabel ?? tc("deleting")) : (confirmLabel ?? tc("delete"))}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

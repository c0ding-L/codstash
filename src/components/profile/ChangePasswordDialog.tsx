"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { type ActionResult, changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = { success: false, error: null };

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  // Stable, so the success effect below runs once per result rather than on
  // every re-render while the popup animates closed.
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Change password</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Enter your current password, then choose a new one.</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <ChangePasswordForm onSuccess={close} />
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({ onSuccess }: Readonly<{ onSuccess: () => void }>) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  useEffect(() => {
    if (!state.success) return;
    toast.success("Password changed.");
    onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Current password
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        New password
        <Input name="newPassword" type="password" autoComplete="new-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Confirm new password
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <DialogFooter className="mt-1">
        <DialogClose render={<Button variant="outline" />} disabled={pending}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </DialogFooter>
    </form>
  );
}

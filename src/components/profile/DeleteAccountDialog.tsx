"use client";

import { useActionState, useState } from "react";

import { type ActionResult, deleteAccount } from "@/actions/profile";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = { success: false, error: null };

/**
 * The delete button only unlocks once the account's email is typed, which
 * works for GitHub accounts too (they have no password to re-enter). The server
 * action checks the same thing again.
 */
export function DeleteAccountDialog({ email, isDemo }: Readonly<{ email: string; isDemo: boolean }>) {
  if (isDemo) {
    return (
      <div className="grid gap-2">
        <Button variant="destructive" disabled className="justify-self-start">
          Delete account
        </Button>
        <p className="text-sm text-muted-foreground">
          The demo account cannot be deleted: the dashboard reads its data.
        </p>
      </div>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>Delete account</AlertDialogTrigger>
      <AlertDialogContent>
        {/* Inside the popup, so it unmounts on close: the typed email and any
            error from the server are gone when it is reopened. */}
        <DeleteAccountForm email={email} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAccountForm({ email }: Readonly<{ email: string }>) {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [typed, setTyped] = useState("");
  // GitHub may store the address with capitals; credentials emails are lowercased.
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={formAction} className="grid gap-4">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
        <AlertDialogDescription>
          Your account, items, collections and tags are deleted for good. Type{" "}
          <span className="font-medium text-foreground">{email}</span> to confirm.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <Input
        name="confirmEmail"
        type="email"
        autoComplete="off"
        aria-label="Your email"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={!matches || pending}>
          {pending ? "Deleting…" : "Delete account"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

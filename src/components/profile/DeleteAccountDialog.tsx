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

interface DeleteAccountDialogProps {
  email: string;
  isDemo: boolean;
  /** False for GitHub-only accounts, which have no password to re-enter. */
  hasPassword: boolean;
}

/**
 * The delete button only unlocks once the account's email is typed, along with
 * the password if the account has one. The server action checks both again.
 */
export function DeleteAccountDialog({ email, isDemo, hasPassword }: Readonly<DeleteAccountDialogProps>) {
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
        {/* Inside the popup, so it unmounts on close: what was typed and any
            error from the server are gone when it is reopened. */}
        <DeleteAccountForm email={email} hasPassword={hasPassword} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAccountForm({ email, hasPassword }: Readonly<{ email: string; hasPassword: boolean }>) {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  // GitHub may store the address with capitals; credentials emails are lowercased.
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const ready = matches && (!hasPassword || password.length > 0);

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
      {hasPassword ? (
        <label className="grid gap-1.5 text-sm font-medium">
          Your password
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={!ready || pending}>
          {pending ? "Deleting…" : "Delete account"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

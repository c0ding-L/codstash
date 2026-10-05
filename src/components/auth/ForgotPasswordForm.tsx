"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The address the link was requested for, once the request went through.
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!EMAIL_PATTERN.test(email)) return setError("Enter a valid email address.");

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body: { success?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (response.status === 429) {
        toast.error(body.error ?? "Too many attempts. Try again later.");
        return;
      }
      if (!response.ok || !body.success) {
        setError(body.error ?? "Could not send the reset link. Try again.");
        return;
      }
      setSentTo(email);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {sentTo ? (
        // Worded for any address: the endpoint does not say whether it exists.
        <div role="status" className="grid gap-2 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="text-muted-foreground">
            If <span className="font-medium text-foreground">{sentTo}</span> belongs to an account
            with a password, a reset link is on its way. It expires in 1 hour.
          </p>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="justify-self-start font-medium underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

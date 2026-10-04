"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ email, token }: Readonly<{ email: string; token: string }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the link was used or expired while the page was open.
  const [invalidToken, setInvalidToken] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password, confirmPassword }),
      });
      const body: { success?: boolean; error?: string; code?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !body.success) {
        setError(body.error ?? "Could not reset the password. Try again.");
        if (body.code === "INVALID_TOKEN") setInvalidToken(true);
        return;
      }
      // The Toaster lives in the root layout, so the toast survives the navigation.
      toast.success("Password updated. You can sign in now.");
      router.push("/sign-in");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <label className="grid gap-1.5 text-sm font-medium">
        New password
        <Input name="password" type="password" autoComplete="new-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Confirm new password
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {invalidToken ? (
            <Link href="/forgot-password" className="font-medium underline underline-offset-4">
              Send a new reset link
            </Link>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || invalidToken}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

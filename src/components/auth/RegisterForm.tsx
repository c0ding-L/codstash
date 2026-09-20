"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!name) return setError("Name is required.");
    if (!EMAIL_PATTERN.test(email)) return setError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const body: { success?: boolean; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !body.success) {
        setError(body.error ?? "Could not create the account. Try again.");
        return;
      }
      // The Toaster lives in the root layout, so the toast survives the navigation.
      toast.success("Account created. You can now sign in.");
      router.push("/sign-in");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-3" noValidate>
        <label className="grid gap-1.5 text-sm font-medium">
          Name
          <Input name="name" autoComplete="name" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Password
          <Input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Confirm password
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

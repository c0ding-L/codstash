"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInWithCredentials, signInWithGitHub, type SignInState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: SignInState = { error: null, email: "" };

export function SignInForm({
  callbackUrl,
  initialError,
}: Readonly<{
  callbackUrl: string;
  /** From a `?error=` redirect, e.g. a failed GitHub sign-in. */
  initialError: string | null;
}>) {
  const [state, formAction, pending] = useActionState(signInWithCredentials, initialState);
  const error = state.error ?? initialError;

  return (
    <>
      <form action={formAction} className="grid gap-3" noValidate={false}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <Input
            name="email"
            type="email"
            defaultValue={state.email}
            autoComplete="email"
            required
            aria-invalid={error ? true : undefined}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Password
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Sign in with GitHub
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </>
  );
}

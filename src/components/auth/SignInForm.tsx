"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { signInWithCredentials, signInWithGitHub, type SignInState } from "@/actions/auth";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: SignInState = { error: null, email: "", unverified: false };

export function SignInForm({
  callbackUrl,
  initialError,
  verificationEnabled,
}: Readonly<{
  callbackUrl: string;
  /** From a `?error=` redirect, e.g. a failed GitHub sign-in. */
  initialError: string | null;
  verificationEnabled: boolean;
}>) {
  const [state, formAction, pending] = useActionState(signInWithCredentials, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  // A rate-limit message is shown as a toast, not inline. Each submission
  // returns a new state object, so every refused attempt toasts again.
  const error = state.rateLimited ? null : (state.error ?? initialError);

  useEffect(() => {
    if (state.rateLimited && state.error) toast.error(state.error);
  }, [state]);

  return (
    <>
      <form action={formAction} className="grid gap-3" noValidate={false}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <Input
            // Remounted with the returned email rather than changing the
            // default value of a mounted field, which Base UI warns about.
            key={state.email}
            ref={emailRef}
            name="email"
            type="email"
            defaultValue={state.email}
            autoComplete="email"
            required
            aria-invalid={error ? true : undefined}
          />
        </label>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="sign-in-password" className="font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {state.unverified ? <ResendVerificationButton email={state.email} /> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {!verificationEnabled || state.unverified ? null : (
        <div className="-mt-1 text-center">
          <ResendVerificationButton
            getEmail={() => emailRef.current?.value ?? ""}
            label="Did not get the verification email? Send it again"
            variant="link"
          />
        </div>
      )}

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

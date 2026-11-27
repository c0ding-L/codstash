"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { signInWithGitHub } from "@/actions/auth";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

export function RegisterForm() {
  const t = useTranslations("auth");
  const te = useTranslations("errors.auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the email belongs to an account that was never verified.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!name) return setError(te("nameRequired"));
    if (name.length > MAX_NAME_LENGTH) return setError(te("nameTooLong", { max: MAX_NAME_LENGTH }));
    if (!EMAIL_PATTERN.test(email)) return setError(t("invalidEmail"));
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(te("passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
    }
    if (password !== confirmPassword) return setError(te("passwordsDontMatch"));

    setError(null);
    setUnverifiedEmail(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const body: {
        success?: boolean;
        error?: string;
        verificationRequired?: boolean;
        emailSent?: boolean;
      } = await response.json().catch(() => ({}));

      if (response.status === 429) {
        toast.error(body.error ?? t("tooManyAttempts"));
        return;
      }
      if (!response.ok || !body.success) {
        setError(body.error ?? t("register.createFailed"));
        return;
      }
      if (body.verificationRequired === false) {
        toast.success(t("register.createdSignIn"));
        router.push("/sign-in");
        return;
      }
      if (body.emailSent === false) {
        // Stay here: the account exists, and the fix is one click away.
        setError(t("register.emailNotSent"));
        setUnverifiedEmail(email);
        return;
      }
      // The Toaster lives in the root layout, so the toast survives the navigation.
      toast.success(t("register.createdCheckEmail"));
      router.push("/sign-in");
    } catch {
      setError(t("unreachable"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form method="post" onSubmit={onSubmit} className="grid gap-3" noValidate>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("name")}
          <Input name="name" autoComplete="name" maxLength={MAX_NAME_LENGTH} required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("email")}
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("password")}
          <Input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("confirmPassword")}
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {unverifiedEmail ? <ResendVerificationButton email={unverifiedEmail} /> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("register.pending") : t("register.submit")}
        </Button>
      </form>

      <form action={signInWithGitHub}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          {t("register.github")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.already")}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("register.signIn")}
        </Link>
      </p>
    </>
  );
}

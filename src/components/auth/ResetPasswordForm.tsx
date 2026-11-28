"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAuthJson, type AuthRouteBody } from "@/lib/auth-request";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

export function ResetPasswordForm({ email, token }: Readonly<{ email: string; token: string }>) {
  const t = useTranslations("auth");
  const te = useTranslations("errors.auth");
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
      return setError(te("passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
    }
    if (password !== confirmPassword) return setError(te("passwordsDontMatch"));

    setError(null);
    setPending(true);
    try {
      const answer = await postAuthJson<AuthRouteBody & { code?: string }>(
        "/api/auth/reset-password",
        { email, token, password, confirmPassword },
        { tooManyAttempts: t("tooManyAttempts") },
      );
      if (!answer) return;
      const { ok, body } = answer;
      if (!ok || !body.success) {
        setError(body.error ?? t("reset.failed"));
        if (body.code === "INVALID_TOKEN") setInvalidToken(true);
        return;
      }
      // The Toaster lives in the root layout, so the toast survives the navigation.
      toast.success(t("reset.updated"));
      router.push("/sign-in");
    } catch {
      setError(t("unreachable"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-3" noValidate>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("newPassword")}
        <Input name="password" type="password" autoComplete="new-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("confirmNewPassword")}
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {invalidToken ? (
            <Link href="/forgot-password" className="font-medium underline underline-offset-4">
              {t("reset.newLink")}
            </Link>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || invalidToken}>
        {pending ? t("reset.pending") : t("reset.submit")}
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAuthJson } from "@/lib/auth-request";
import { isValidEmail } from "@/lib/auth-rules";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The address the link was requested for, once the request went through.
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!isValidEmail(email)) return setError(t("invalidEmail"));

    setError(null);
    setPending(true);
    try {
      const answer = await postAuthJson("/api/auth/forgot-password", { email }, { tooManyAttempts: t("tooManyAttempts") });
      if (!answer) return;
      const { ok, body } = answer;
      if (!ok || !body.success) {
        setError(body.error ?? t("forgot.sendFailed"));
        return;
      }
      setSentTo(email);
    } catch {
      setError(t("unreachable"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {sentTo ? (
        // Worded for any address: the endpoint does not say whether it exists.
        <div role="status" className="grid gap-2 text-sm">
          <p className="font-medium">{t("forgot.checkInbox")}</p>
          <p className="text-muted-foreground">
            {t.rich("forgot.sent", {
              email: sentTo,
              strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
            })}
          </p>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="justify-self-start font-medium underline-offset-4 hover:underline"
          >
            {t("forgot.otherEmail")}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("email")}
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t("forgot.pending") : t("forgot.submit")}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {t("forgot.remembered")}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("forgot.signIn")}
        </Link>
      </p>
    </>
  );
}

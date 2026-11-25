"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Asks for a new verification email. The endpoint answers the same way for any
 * address, so the confirmation is worded to match.
 */
export function ResendVerificationButton({
  email,
  getEmail,
  label,
  variant = "outline",
}: Readonly<{
  /** The address to send to, when it is already known. */
  email?: string;
  /** Otherwise read when clicked, e.g. from a form field the user is still typing in. */
  getEmail?: () => string;
  label?: string;
  variant?: "outline" | "link";
}>) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);

  async function onClick() {
    const address = (getEmail ? getEmail() : email ?? "").trim();
    if (!address) {
      toast.error(t("resend.emailFirst"));
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      if (response.status === 429) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        toast.error(body.error ?? t("tooManyAttempts"));
      } else if (response.ok) {
        toast.success(t("resend.sent"));
      } else {
        toast.error(t("resend.failed"));
      }
    } catch {
      toast.error(t("unreachable"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={variant === "link" ? "sm" : "lg"}
      onClick={onClick}
      disabled={pending || (!getEmail && !email)}
    >
      {pending ? t("resend.pending") : (label ?? t("resend.label"))}
    </Button>
  );
}

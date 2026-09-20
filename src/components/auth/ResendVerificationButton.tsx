"use client";

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
  label = "Send a new verification email",
  variant = "outline",
}: Readonly<{
  /** The address to send to, when it is already known. */
  email?: string;
  /** Otherwise read when clicked, e.g. from a form field the user is still typing in. */
  getEmail?: () => string;
  label?: string;
  variant?: "outline" | "link";
}>) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    const address = (getEmail ? getEmail() : email ?? "").trim();
    if (!address) {
      toast.error("Enter your email address first.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      if (response.ok) {
        toast.success("If this account is waiting for verification, a new email is on its way.");
      } else {
        toast.error("Could not send the email. Try again.");
      }
    } catch {
      toast.error("Could not reach the server. Try again.");
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
      {pending ? "Sending…" : label}
    </Button>
  );
}

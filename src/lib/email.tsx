import type { ReactElement } from "react";
import { render } from "react-email";
import { Resend } from "resend";

import { AccountExistsEmail } from "@/emails/AccountExistsEmail";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";
import { VerificationEmail } from "@/emails/VerificationEmail";

interface LinkEmailParams {
  to: string;
  name: string | null;
  url: string;
}

/**
 * Returns whether Resend accepted the message and never throws: `emails.send`
 * resolves to `{ data, error }` rather than rejecting, so a failed send has to
 * be read from `error`. Links are never logged.
 */
async function sendEmail({ to, subject, email }: { to: string; subject: string; email: ReactElement }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY and EMAIL_FROM must both be set.");
    return false;
  }

  try {
    // Rendered here rather than through Resend's `react` option, which loads
    // its renderer with a dynamic import that a bundler can miss.
    const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);

    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text });

    if (error) {
      console.error(`[email] Resend rejected the message: ${error.name}: ${error.message}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Could not reach Resend:", error);
    return false;
  }
}

export function sendVerificationEmail({ to, name, url }: LinkEmailParams) {
  return sendEmail({
    to,
    subject: "Verify your CodStash email",
    email: <VerificationEmail name={name} url={url} />,
  });
}

export function sendPasswordResetEmail({ to, name, url }: LinkEmailParams) {
  return sendEmail({
    to,
    subject: "Reset your CodStash password",
    email: <PasswordResetEmail name={name} url={url} />,
  });
}

export function sendAccountExistsEmail({
  to,
  name,
  signInUrl,
  resetUrl,
}: {
  to: string;
  name: string | null;
  signInUrl: string;
  resetUrl: string | null;
}) {
  return sendEmail({
    to,
    subject: "You already have a CodStash account",
    email: <AccountExistsEmail name={name} signInUrl={signInUrl} resetUrl={resetUrl} />,
  });
}

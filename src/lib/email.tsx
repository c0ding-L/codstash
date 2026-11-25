import type { ReactElement } from "react";
import { render } from "react-email";
import { Resend } from "resend";

import { AccountExistsEmail } from "@/emails/AccountExistsEmail";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";
import { emailTranslator } from "@/emails/translator";
import { VerificationEmail } from "@/emails/VerificationEmail";
import type { Locale } from "@/lib/locale";

interface LinkEmailParams {
  to: string;
  /** The language to write in: the requester's for links they asked for, the owner's otherwise. */
  locale: Locale;
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

export function sendVerificationEmail({ to, locale, name, url }: LinkEmailParams) {
  return sendEmail({
    to,
    subject: emailTranslator(locale)("verification.subject"),
    email: <VerificationEmail locale={locale} name={name} url={url} />,
  });
}

export function sendPasswordResetEmail({ to, locale, name, url }: LinkEmailParams) {
  return sendEmail({
    to,
    subject: emailTranslator(locale)("passwordReset.subject"),
    email: <PasswordResetEmail locale={locale} name={name} url={url} />,
  });
}

export function sendAccountExistsEmail({
  to,
  locale,
  name,
  signInUrl,
  resetUrl,
}: {
  to: string;
  locale: Locale;
  name: string | null;
  signInUrl: string;
  resetUrl: string | null;
}) {
  return sendEmail({
    to,
    subject: emailTranslator(locale)("accountExists.subject"),
    email: <AccountExistsEmail locale={locale} name={name} signInUrl={signInUrl} resetUrl={resetUrl} />,
  });
}

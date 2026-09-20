import { render } from "react-email";
import { Resend } from "resend";

import { VerificationEmail } from "@/emails/VerificationEmail";

interface VerificationEmailParams {
  to: string;
  name: string | null;
  url: string;
}

/**
 * Sends the verification link. Returns whether Resend accepted the message and
 * never throws: `emails.send` resolves to `{ data, error }` rather than
 * rejecting, so a failed send has to be read from `error`. The link itself is
 * never logged.
 */
export async function sendVerificationEmail({ to, name, url }: VerificationEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY and EMAIL_FROM must both be set.");
    return false;
  }

  try {
    // Rendered here rather than through Resend's `react` option, which loads
    // its renderer with a dynamic import that a bundler can miss.
    const email = <VerificationEmail name={name} url={url} />;
    const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: "Verify your CodStash email",
      html,
      text,
    });

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

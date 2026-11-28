import { consumeEmailToken, issueEmailToken, verificationIdentifier, type IssueResult } from "@/lib/email-token";
import { sendVerificationEmail } from "@/lib/email";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export { hashToken, type IssueResult } from "@/lib/email-token";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Replaces any earlier token for this email with a fresh one and emails the
 * link. With `throttle`, a token issued in the last minute blocks a new one.
 */
export async function issueVerificationEmail(
  user: { email: string; name: string | null },
  { throttle = false, locale = DEFAULT_LOCALE }: { throttle?: boolean; locale?: Locale } = {},
): Promise<IssueResult> {
  const identifier = verificationIdentifier(user.email);
  return issueEmailToken({
    identifier,
    ttlMs: TOKEN_TTL_MS,
    throttle,
    path: "/verify-email",
    email: identifier,
    send: (url) => sendVerificationEmail({ to: identifier, locale, name: user.name, url }),
    logTag: "verification",
  });
}

/**
 * Consumes the token and marks the user verified.
 */
export async function verifyEmailToken(email: string, token: string) {
  const identifier = verificationIdentifier(email);
  if (!(await consumeEmailToken(identifier, token))) return false;

  const user = await prisma.user.findUnique({ where: { email: identifier } });
  if (!user) return false;

  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  return true;
}

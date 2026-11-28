import { revokeAllApiTokensQuery } from "@/lib/db/api-tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { consumeEmailToken, hashToken, issueEmailToken, resetIdentifier, verificationIdentifier, type IssueResult } from "@/lib/email-token";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Replaces any earlier reset token for this email and sends the link. A token
 * issued in the last minute blocks a new one. `locale` is the language of the email: the
 * requester's, from the forgot-password request.
 */
export async function issuePasswordResetEmail(
  user: { email: string; name: string | null },
  locale: Locale = DEFAULT_LOCALE,
): Promise<IssueResult> {
  const email = user.email.toLowerCase();
  return issueEmailToken({
    identifier: resetIdentifier(email),
    ttlMs: TOKEN_TTL_MS,
    throttle: true,
    path: "/reset-password",
    email,
    send: (url) => sendPasswordResetEmail({ to: email, locale, name: user.name, url }),
    logTag: "password-reset",
  });
}

/** Read-only check, so opening the page does not use the link up. */
export async function isPasswordResetTokenValid(email: string, token: string) {
  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: resetIdentifier(email), token: hashToken(token) } },
  });
  return row !== null && row.expires > new Date();
}

/**
 * Consumes the token and sets the new password hash. Following the link proves the inbox is theirs, so an unverified account is
 * marked verified and its pending verification tokens are dropped.
 */
export async function resetPassword(email: string, token: string, passwordHash: string) {
  const normalizedEmail = verificationIdentifier(email);
  if (!(await consumeEmailToken(resetIdentifier(normalizedEmail), token))) return false;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user?.password) return false;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        // Ends every session signed in before the reset.
        passwordChangedAt: new Date(),
        ...(user.emailVerified ? {} : { emailVerified: new Date() }),
      },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } }),
    // Like a password change, a reset revokes the API tokens (C1).
    revokeAllApiTokensQuery(user.id),
  ]);
  return true;
}

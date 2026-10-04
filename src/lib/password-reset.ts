import { randomBytes } from "node:crypto";

import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { hashToken, type IssueResult } from "@/lib/verification";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

/**
 * Reset tokens share `VerificationToken` with email verification, so they are
 * kept apart by identifier. A second `@` cannot occur in any address the app
 * accepts, so `reset@<email>` never collides with a verification identifier,
 * which is the bare email.
 */
function resetIdentifier(email: string) {
  return `reset@${email.trim().toLowerCase()}`;
}

/**
 * Replaces any earlier reset token for this email and sends the link. A token
 * issued in the last minute blocks a new one; with no `createdAt` column, the
 * issue time is `expires - TTL`.
 */
export async function issuePasswordResetEmail(user: { email: string; name: string | null }): Promise<IssueResult> {
  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    console.error("[password-reset] APP_URL is not set.");
    return "failed";
  }

  const email = user.email.toLowerCase();
  const identifier = resetIdentifier(email);

  const latest = await prisma.verificationToken.findFirst({
    where: { identifier },
    orderBy: { expires: "desc" },
  });
  if (latest && latest.expires.getTime() - TOKEN_TTL_MS > Date.now() - RESEND_INTERVAL_MS) {
    return "throttled";
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const url = `${baseUrl}/reset-password?${new URLSearchParams({ token, email })}`;
  const sent = await sendPasswordResetEmail({ to: email, name: user.name, url });

  if (!sent) {
    // Otherwise the throttle would block a retry for a link nobody received.
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return "failed";
  }
  return "sent";
}

/** Read-only check, so opening the page does not use the link up. */
export async function isPasswordResetTokenValid(email: string, token: string) {
  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: resetIdentifier(email), token: hashToken(token) } },
  });
  return row !== null && row.expires > new Date();
}

/**
 * Consumes the token and sets the new password hash. The delete is the
 * single-use guard: two concurrent requests cannot both see `count === 1`.
 * Following the link proves the inbox is theirs, so an unverified account is
 * marked verified and its pending verification tokens are dropped.
 */
export async function resetPassword(email: string, token: string, passwordHash: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier: resetIdentifier(normalizedEmail), token: hashToken(token), expires: { gt: new Date() } },
  });
  if (count === 0) return false;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user?.password) return false;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, ...(user.emailVerified ? {} : { emailVerified: new Date() }) },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } }),
  ]);
  return true;
}

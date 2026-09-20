import { createHash, randomBytes } from "node:crypto";

import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

/** Only the hash is stored, so a database read does not yield a usable link. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type IssueResult = "sent" | "failed" | "throttled";

/**
 * Replaces any earlier token for this email with a fresh one and emails the
 * link. With `throttle`, a token issued in the last minute blocks a new one;
 * `VerificationToken` has no `createdAt`, so the issue time is `expires - TTL`.
 */
export async function issueVerificationEmail(
  user: { email: string; name: string | null },
  { throttle = false }: { throttle?: boolean } = {},
): Promise<IssueResult> {
  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    console.error("[verification] APP_URL is not set.");
    return "failed";
  }

  const identifier = user.email.toLowerCase();

  if (throttle) {
    const latest = await prisma.verificationToken.findFirst({
      where: { identifier },
      orderBy: { expires: "desc" },
    });
    if (latest && latest.expires.getTime() - TOKEN_TTL_MS > Date.now() - RESEND_INTERVAL_MS) {
      return "throttled";
    }
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const url = `${baseUrl}/verify-email?${new URLSearchParams({ token, email: identifier })}`;
  const sent = await sendVerificationEmail({ to: identifier, name: user.name, url });

  if (!sent) {
    // Otherwise the throttle would block a retry for a link nobody received.
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return "failed";
  }
  return "sent";
}

/**
 * Consumes the token and marks the user verified. The delete is the single-use
 * guard: two concurrent requests cannot both see `count === 1`.
 */
export async function verifyEmailToken(email: string, token: string) {
  const identifier = email.trim().toLowerCase();

  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier, token: hashToken(token), expires: { gt: new Date() } },
  });
  if (count === 0) return false;

  const user = await prisma.user.findUnique({ where: { email: identifier } });
  if (!user) return false;

  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  return true;
}

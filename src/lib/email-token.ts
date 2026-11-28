// The single-use tokens emailed for verification and password reset. Both live in
// `VerificationToken`, kept apart by identifier. Server-only.

import { randomBytes } from "node:crypto";

import { hashToken } from "@/lib/api-token";
import { appBaseUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

/** Only the hash is stored, so a database read does not yield a usable link. */
export { hashToken };

export type IssueResult = "sent" | "failed" | "throttled";

/** A token issued less than this long ago blocks a new one, when throttled. */
const RESEND_INTERVAL_MS = 60 * 1000;

/** A verification token's identifier: the bare, lowercased email. */
export function verificationIdentifier(email: string) {
  return email.trim().toLowerCase();
}

/**
 * A reset token's identifier. A second `@` cannot occur in any address the app accepts, so
 * `reset@<email>` never collides with a verification identifier, which is the bare email.
 */
export function resetIdentifier(email: string) {
  return `reset@${email.trim().toLowerCase()}`;
}

interface IssueOptions {
  identifier: string;
  ttlMs: number;
  /** A token issued in the last minute blocks a new one. */
  throttle: boolean;
  /** The page the link opens, e.g. `/verify-email`; it gets `?token=…&email=…`. */
  path: string;
  /** The lowercased address, put in the link. */
  email: string;
  /** Sends the email with this link; false when it was not sent. */
  send: (url: string) => Promise<boolean>;
  logTag: string;
}

/**
 * Replaces any earlier token for this identifier with a fresh one and emails the link.
 * `VerificationToken` has no `createdAt`, so the issue time is `expires - TTL`.
 */
export async function issueEmailToken({ identifier, ttlMs, throttle, path, email, send, logTag }: IssueOptions): Promise<IssueResult> {
  const baseUrl = appBaseUrl(logTag);
  if (!baseUrl) return "failed";

  if (throttle) {
    const latest = await prisma.verificationToken.findFirst({
      where: { identifier },
      orderBy: { expires: "desc" },
    });
    if (latest && latest.expires.getTime() - ttlMs > Date.now() - RESEND_INTERVAL_MS) {
      return "throttled";
    }
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(Date.now() + ttlMs) },
    }),
  ]);

  const sent = await send(`${baseUrl}${path}?${new URLSearchParams({ token, email })}`);
  if (!sent) {
    // Otherwise the throttle would block a retry for a link nobody received.
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return "failed";
  }
  return "sent";
}

/**
 * Consumes an unexpired token. The delete is the single-use guard: two concurrent requests
 * cannot both see `count === 1`.
 */
export async function consumeEmailToken(identifier: string, token: string): Promise<boolean> {
  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier, token: hashToken(token), expires: { gt: new Date() } },
  });
  return count > 0;
}

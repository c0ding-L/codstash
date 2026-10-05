import bcrypt from "bcryptjs";
import { after, NextResponse } from "next/server";

import type { User } from "@/generated/prisma/client";
import { sendAccountExistsEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { issueVerificationEmail } from "@/lib/verification";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Tells the owner of an existing account that someone tried to register with
 * it: a fresh verification link if it is still unverified, otherwise a pointer
 * to sign-in and forgot password. The account itself is never changed.
 */
async function notifyExistingAccount(user: User, verificationRequired: boolean) {
  if (verificationRequired && user.password && !user.emailVerified) {
    // A link sent in the last minute already did the job.
    return (await issueVerificationEmail(user, { throttle: true })) !== "failed";
  }

  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    console.error("[register] APP_URL is not set.");
    return false;
  }
  return sendAccountExistsEmail({
    to: user.email,
    name: user.name,
    signInUrl: `${baseUrl}/sign-in`,
    resetUrl: user.password ? `${baseUrl}/forgot-password` : null,
  });
}

/**
 * Answers the same way whether or not the email is registered, so it cannot be
 * used to probe for accounts; the owner of an existing one is emailed instead.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const { name, email, password, confirmPassword } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return fail("name, email, password and confirmPassword are required.", 400);
  }

  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!trimmedName) return fail("Name is required.", 400);
  if (!EMAIL_PATTERN.test(normalizedEmail)) return fail("Email is not valid.", 400);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  if (password !== confirmPassword) return fail("Passwords do not match.", 400);

  const verificationRequired = isEmailVerificationEnabled();
  // Before the lookup, so a new and an existing email take the same slow path.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  let emailSent = false;

  if (existing) {
    if (verificationRequired) {
      // A new registration sends an email before answering too.
      emailSent = await notifyExistingAccount(existing, true);
    } else {
      // A new registration sends nothing, so this must not delay the answer.
      after(async () => {
        try {
          await notifyExistingAccount(existing, false);
        } catch (error) {
          console.error("[register] notifying an existing account failed:", error);
        }
      });
    }
  } else {
    const user = await prisma.user.create({
      data: { name: trimmedName, email: normalizedEmail, password: passwordHash },
      select: { name: true, email: true },
    });
    // The account exists either way; `emailSent` lets the client say so when the
    // send failed, and "resend" on the sign-in form recovers from it.
    emailSent = verificationRequired && (await issueVerificationEmail(user)) === "sent";
  }

  return NextResponse.json({ success: true, verificationRequired, emailSent }, { status: 201 });
}

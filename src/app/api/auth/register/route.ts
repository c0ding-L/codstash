import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { issueVerificationEmail } from "@/lib/verification";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });
}

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

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Never replaced or modified: the owner has to activate it, and the client
    // gets a code so it can offer to send a new verification email.
    if (existing.password && !existing.emailVerified) {
      return fail(
        "An account with this email already exists but has not been verified yet. Check your inbox, or send a new verification email.",
        409,
        "EMAIL_NOT_VERIFIED",
      );
    }
    return fail("An account with this email already exists.", 409);
  }

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    },
    select: { id: true, name: true, email: true },
  });

  // The account exists either way; `emailSent` lets the client say so when the
  // send failed, and "resend" on the sign-in form recovers from it.
  const emailSent = (await issueVerificationEmail(user)) === "sent";

  return NextResponse.json({ success: true, user, emailSent }, { status: 201 });
}

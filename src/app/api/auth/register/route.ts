import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
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
  if (existing) return fail("An account with this email already exists.", 409);

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ success: true, user }, { status: 201 });
}

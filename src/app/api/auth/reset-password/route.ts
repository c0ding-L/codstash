import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { resetPassword } from "@/lib/password-reset";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

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

  const { email, token, password, confirmPassword } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return fail("email, token, password and confirmPassword are required.", 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  if (password !== confirmPassword) return fail("Passwords do not match.", 400);

  // Hashed first, so nothing slow sits between consuming the token and saving
  // the password.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (!(await resetPassword(email, token, passwordHash))) {
    return fail("This reset link was already used, has expired, or is not valid.", 400, "INVALID_TOKEN");
  }

  return NextResponse.json({ success: true });
}

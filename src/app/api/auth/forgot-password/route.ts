import { after, NextResponse } from "next/server";

import { issuePasswordResetEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, tooManyAttemptsResponse } from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Always answers the same way, whether or not the address is registered, so it
 * cannot be used to probe for accounts. The lookup and the send run after the
 * response, so the timing does not give it away either.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit("forgotPassword", getClientIp(request.headers));
  if (!limit.success) return tooManyAttemptsResponse(limit.reset);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = (body as { email?: unknown } | null)?.email;
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return NextResponse.json({ success: false, error: "Email is not valid." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      // GitHub-only users have no password to reset.
      if (user?.password) await issuePasswordResetEmail(user);
    } catch (error) {
      console.error("[forgot-password] failed:", error);
    }
  });

  return NextResponse.json({ success: true });
}

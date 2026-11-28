import { after, NextResponse } from "next/server";

import { getErrors } from "@/i18n/errors-server";
import { authFail, readAuthBody } from "@/lib/auth-route";
import { isValidEmail, normalizeEmail } from "@/lib/auth-rules";
import { getRequestLocale } from "@/i18n/request";
import { issuePasswordResetEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, tooManyAttemptsResponse } from "@/lib/rate-limit";

/**
 * Always answers the same way, whether or not the address is registered, so it
 * cannot be used to probe for accounts. The lookup and the send run after the
 * response, so the timing does not give it away either.
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit("forgotPassword", getClientIp(request.headers));
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const read = await readAuthBody(request);
  if (read instanceof Response) return read;
  const { body } = read;

  const email = (body as { email?: unknown } | null)?.email;
  if (!isValidEmail(email)) return authFail((await getErrors()).message("auth.emailInvalid"), 400);
  const normalizedEmail = normalizeEmail(email);

  // Read now: the request's cookies are not available inside `after`.
  const { locale } = await getRequestLocale();
  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      // GitHub-only users have no password to reset.
      if (user?.password) await issuePasswordResetEmail(user, locale);
    } catch (error) {
      console.error("[forgot-password] failed:", error);
    }
  });

  return NextResponse.json({ success: true });
}

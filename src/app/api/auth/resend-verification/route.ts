import { after, NextResponse } from "next/server";

import { getErrors } from "@/i18n/errors-server";
import { authFail, readAuthBody } from "@/lib/auth-route";
import { isValidEmail, normalizeEmail } from "@/lib/auth-rules";
import { getRequestLocale } from "@/i18n/request";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { issueVerificationEmail } from "@/lib/verification";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, tooManyAttemptsResponse } from "@/lib/rate-limit";

/**
 * Always answers the same way, whether or not the address is registered or
 * already verified, so it cannot be used to probe for accounts. The lookup and
 * the send run after the response, so the timing does not give it away either.
 */
export async function POST(request: Request) {
  const read = await readAuthBody(request);
  if (read instanceof Response) return read;
  const { body } = read;

  const email = (body as { email?: unknown } | null)?.email;
  if (!isValidEmail(email)) return authFail((await getErrors()).message("auth.emailInvalid"), 400);
  const normalizedEmail = normalizeEmail(email);

  const limit = await checkRateLimit("resendVerification", `${getClientIp(request.headers)}:${normalizedEmail}`);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  if (!isEmailVerificationEnabled()) return NextResponse.json({ success: true });

  // Read now: the request's cookies are not available inside `after`.
  const { locale } = await getRequestLocale();
  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      // GitHub-only users have no password and nothing to verify.
      if (user?.password && !user.emailVerified) {
        await issueVerificationEmail(user, { throttle: true, locale });
      }
    } catch (error) {
      console.error("[resend-verification] failed:", error);
    }
  });

  return NextResponse.json({ success: true });
}

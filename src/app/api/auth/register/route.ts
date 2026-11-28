import { after, NextResponse } from "next/server";

import type { User } from "@/generated/prisma/client";
import { getErrors } from "@/i18n/errors-server";
import { getRequestLocale } from "@/i18n/request";
import { appBaseUrl } from "@/lib/app-url";
import { authFail as fail, readAuthBody } from "@/lib/auth-route";
import { EMAIL_PATTERN, MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/auth-rules";
import { sendAccountExistsEmail } from "@/lib/email";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale";
import { hashPassword } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { issueVerificationEmail } from "@/lib/verification";

/**
 * Tells the owner of an existing account that someone tried to register with
 * it: a fresh verification link if it is still unverified, otherwise a pointer
 * to sign-in and forgot password. The account itself is never changed.
 */
async function notifyExistingAccount(user: User, verificationRequired: boolean) {
  // Written to the account's owner, not to whoever registered: in the owner's saved language.
  const locale = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  if (verificationRequired && user.password && !user.emailVerified) {
    // A link sent in the last minute already did the job.
    return (await issueVerificationEmail(user, { throttle: true, locale })) !== "failed";
  }

  const baseUrl = appBaseUrl("register");
  if (!baseUrl) return false;
  return sendAccountExistsEmail({
    to: user.email,
    locale,
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
  const limit = await checkRateLimit("register", getClientIp(request.headers));
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const read = await readAuthBody(request);
  if (read instanceof Response) return read;
  const { body } = read;

  const { name, email, password, confirmPassword } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return fail("name, email, password and confirmPassword are required.", 400);
  }

  const e = await getErrors();
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!trimmedName) return fail(e.message("auth.nameRequired"), 400);
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return fail(e.message("auth.nameTooLong", { max: MAX_NAME_LENGTH }), 400);
  }
  if (!EMAIL_PATTERN.test(normalizedEmail)) return fail(e.message("auth.emailInvalid"), 400);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(e.message("auth.passwordTooShort", { min: MIN_PASSWORD_LENGTH }), 400);
  }
  if (password !== confirmPassword) return fail(e.message("auth.passwordsDontMatch"), 400);

  const verificationRequired = isEmailVerificationEnabled();
  // Before the lookup, so a new and an existing email take the same slow path.
  const passwordHash = await hashPassword(password);
  // The registrant's language: saved on a new account, so later emails to its owner use it. Not
  // the bare default, which nobody chose: null keeps following the browser on a new device.
  const { locale, source } = await getRequestLocale();

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
      data: { name: trimmedName, email: normalizedEmail, password: passwordHash, locale: source === "default" ? null : locale },
      select: { name: true, email: true },
    });
    // The account exists either way; `emailSent` lets the client say so when the
    // send failed, and "resend" on the sign-in form recovers from it.
    emailSent = verificationRequired && (await issueVerificationEmail(user, { locale })) === "sent";
  }

  return NextResponse.json({ success: true, verificationRequired, emailSent }, { status: 201 });
}

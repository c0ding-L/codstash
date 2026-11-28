import { NextResponse } from "next/server";

import { getErrors } from "@/i18n/errors-server";
import { authFail as fail, readAuthBody } from "@/lib/auth-route";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { hashPassword } from "@/lib/password-hash";
import { resetPassword } from "@/lib/password-reset";
import { checkRateLimit, getClientIp, tooManyAttemptsResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = await checkRateLimit("resetPassword", getClientIp(request.headers));
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  const read = await readAuthBody(request);
  if (read instanceof Response) return read;
  const { body } = read;

  const { email, token, password, confirmPassword } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return fail("email, token, password and confirmPassword are required.", 400);
  }
  const e = await getErrors();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(e.message("auth.passwordTooShort", { min: MIN_PASSWORD_LENGTH }), 400);
  }
  if (password !== confirmPassword) return fail(e.message("auth.passwordsDontMatch"), 400);

  // Hashed first, so nothing slow sits between consuming the token and saving
  // the password.
  const passwordHash = await hashPassword(password);
  if (!(await resetPassword(email, token, passwordHash))) {
    return fail(e.message("auth.resetLinkInvalid"), 400, "INVALID_TOKEN");
  }

  return NextResponse.json({ success: true });
}

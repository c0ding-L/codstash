import { CredentialsSignin } from "next-auth";

export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";

/**
 * Thrown from the Credentials `authorize` once the password is known to be
 * right, so it never tells a stranger that an email is registered. The `code`
 * is what `signInWithCredentials` reads to tell it from a wrong password.
 */
export class EmailNotVerifiedError extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

export const RATE_LIMITED_CODE = "rate_limited";

/**
 * Thrown from the Credentials `authorize` once an IP + email pair has used up
 * its sign-in attempts. Server-side `signIn` rethrows this same instance, so
 * `signInWithCredentials` can read `reset` to say how long to wait.
 */
export class RateLimitedError extends CredentialsSignin {
  code = RATE_LIMITED_CODE;

  constructor(readonly reset: number) {
    super();
  }
}

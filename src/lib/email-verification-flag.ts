/**
 * Server-only. On unless `EMAIL_VERIFICATION_ENABLED` is exactly `"false"`, so a
 * missing or mistyped value keeps verification on. Accounts created while it is
 * off keep `emailVerified` unset and are asked to verify once it is back on.
 */
export function isEmailVerificationEnabled() {
  return process.env.EMAIL_VERIFICATION_ENABLED !== "false";
}

// The account rules the auth forms check as you type and the server checks again. Client-safe:
// no imports, so a `"use client"` form can use it as well as a route.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
/** The name goes into the verification email, sent to an address the registrant typed. */
export const MAX_NAME_LENGTH = 100;

/** Whether this is an email address the app accepts, surrounding spaces aside. */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_PATTERN.test(value.trim());
}

/** How every email is stored and looked up: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

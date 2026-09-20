"use server";

import { AuthError, CredentialsSignin } from "next-auth";

import { signIn, signOut } from "@/auth";
import { EMAIL_NOT_VERIFIED_CODE } from "@/lib/auth-errors";

export interface SignInState {
  error: string | null;
  /** Sent back because React resets the form after an action, which would clear it. */
  email: string;
  /** The password was right but the email has not been verified yet. */
  unverified: boolean;
}

const DEFAULT_REDIRECT = "/dashboard";

/**
 * `callbackUrl` arrives from the query string, so only same-origin paths are
 * accepted; anything else would make the sign-in an open redirect.
 */
function safeRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return DEFAULT_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

export async function signInWithCredentials(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return {
      error: "Enter your email and password.",
      email: typeof email === "string" ? email : "",
      unverified: false,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === EMAIL_NOT_VERIFIED_CODE) {
      return {
        error: "Verify your email first. Check your inbox for the link, or send a new one.",
        email,
        unverified: true,
      };
    }
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Invalid email or password."
            : "Something went wrong. Try again.",
        email,
        unverified: false,
      };
    }
    // A successful sign-in redirects by throwing; that must not be swallowed.
    throw error;
  }

  return { error: null, email, unverified: false };
}

export async function signInWithGitHub(formData: FormData) {
  await signIn("github", { redirectTo: safeRedirect(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}

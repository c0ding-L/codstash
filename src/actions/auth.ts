"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

export interface SignInState {
  error: string | null;
  /** Sent back because React resets the form after an action, which would clear it. */
  email: string;
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
    return { error: "Enter your email and password.", email: typeof email === "string" ? email : "" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Invalid email or password."
            : "Something went wrong. Try again.",
        email,
      };
    }
    // A successful sign-in redirects by throwing; that must not be swallowed.
    throw error;
  }

  return { error: null, email };
}

export async function signInWithGitHub(formData: FormData) {
  await signIn("github", { redirectTo: safeRedirect(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}

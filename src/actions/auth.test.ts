import { AuthError, CredentialsSignin } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { signInWithCredentials, signInWithGitHub, type SignInState } from "@/actions/auth";
import { signIn } from "@/auth";
import { EmailNotVerifiedError, RateLimitedError } from "@/lib/auth-errors";

vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

const INITIAL: SignInState = { error: null, email: "", unverified: false };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const credentials = { email: "a@example.com", password: "correct horse" };

describe("signInWithCredentials", () => {
  it.each([
    [{ email: "a@example.com" }, "a@example.com"],
    [{ password: "correct horse" }, ""],
    [{ email: "", password: "" }, ""],
  ])("asks for both fields without calling signIn: %j", async (fields, email) => {
    const result = await signInWithCredentials(INITIAL, form(fields));

    expect(result).toEqual({ error: "Enter your email and password.", email, unverified: false });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("passes the credentials and a same-origin callback to signIn", async () => {
    const result = await signInWithCredentials(INITIAL, form({ ...credentials, callbackUrl: "/items/snippets?a=1" }));

    expect(signIn).toHaveBeenCalledWith("credentials", { ...credentials, redirectTo: "/items/snippets?a=1" });
    expect(result.error).toBeNull();
  });

  it("defaults to the dashboard without a callback", async () => {
    await signInWithCredentials(INITIAL, form(credentials));

    expect(signIn).toHaveBeenCalledWith("credentials", { ...credentials, redirectTo: "/dashboard" });
  });

  // Each of these would turn the sign-in into an open redirect.
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil.example", "evil.example"])(
    "refuses the callback %s",
    async (callbackUrl) => {
      await signInWithCredentials(INITIAL, form({ ...credentials, callbackUrl }));

      expect(signIn).toHaveBeenCalledWith("credentials", { ...credentials, redirectTo: "/dashboard" });
    },
  );

  it("says the credentials are wrong without saying which", async () => {
    vi.mocked(signIn).mockRejectedValue(new CredentialsSignin());

    const result = await signInWithCredentials(INITIAL, form(credentials));

    expect(result).toEqual({ error: "Invalid email or password.", email: credentials.email, unverified: false });
  });

  it("flags an unverified email", async () => {
    vi.mocked(signIn).mockRejectedValue(new EmailNotVerifiedError());

    const result = await signInWithCredentials(INITIAL, form(credentials));

    expect(result.unverified).toBe(true);
    expect(result.error).toContain("Verify your email");
  });

  it("reports a rate limit with the wait", async () => {
    vi.mocked(signIn).mockRejectedValue(new RateLimitedError(Date.now() + 120_000));

    const result = await signInWithCredentials(INITIAL, form(credentials));

    expect(result.rateLimited).toBe(true);
    expect(result.error).toBe("Too many attempts. Please try again in 2 minutes.");
  });

  it("answers generically for any other auth failure", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError("provider exploded"));

    const result = await signInWithCredentials(INITIAL, form(credentials));

    expect(result.error).toBe("Something went wrong. Try again.");
  });

  // A successful sign-in redirects by throwing, so swallowing it would strand the user.
  it("rethrows anything that is not an auth error", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    vi.mocked(signIn).mockRejectedValue(redirect);

    await expect(signInWithCredentials(INITIAL, form(credentials))).rejects.toBe(redirect);
  });
});

describe("signInWithGitHub", () => {
  it("applies the same callback check", async () => {
    await signInWithGitHub(form({ callbackUrl: "//evil.example" }));

    expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/dashboard" });
  });
});

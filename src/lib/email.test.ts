import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendAccountExistsEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

// Resend is replaced by a stub that keeps what would have been sent; nothing leaves the test.
const sent: { subject: string; html: string; text: string }[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: { subject: string; html: string; text: string }) => {
        sent.push(message);
        return { data: { id: "test" }, error: null };
      },
    };
  },
}));

beforeEach(() => {
  sent.length = 0;
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "Cortex <test@example.com>");
});

const URL = "https://cortex.test/verify-email?token=abc";

describe("emails", () => {
  it("writes the verification email in English", async () => {
    expect(await sendVerificationEmail({ to: "ada@example.com", locale: "en", name: "Ada", url: URL })).toBe(true);

    const [message] = sent;
    expect(message?.subject).toBe("Verify your Cortex email");
    expect(message?.html).toContain('lang="en"');
    expect(message?.text).toContain("Hi Ada,");
    expect(message?.text).toContain("Verify my email");
  });

  it("writes the verification email in French", async () => {
    await sendVerificationEmail({ to: "ada@example.com", locale: "fr", name: null, url: URL });

    const [message] = sent;
    expect(message?.subject).toBe("Vérifiez votre adresse e-mail Cortex");
    expect(message?.html).toContain('lang="fr"');
    expect(message?.text).toContain("Bonjour,");
    expect(message?.text).toContain("Vérifier mon adresse e-mail");
  });

  it("greets someone named like a keyword by their name", async () => {
    await sendPasswordResetEmail({ to: "ada@example.com", locale: "en", name: "none", url: URL });

    expect(sent[0]?.text).toContain("Hi none,");
  });

  it("writes the password reset email in French", async () => {
    await sendPasswordResetEmail({ to: "ada@example.com", locale: "fr", name: "Ada", url: URL });

    expect(sent[0]?.subject).toBe("Réinitialisez votre mot de passe Cortex");
    expect(sent[0]?.text).toContain("Bonjour Ada,");
    expect(sent[0]?.text).toContain("expire au bout d’une heure");
  });

  it("writes the account-exists email in French, with the reset link", async () => {
    await sendAccountExistsEmail({
      to: "ada@example.com",
      locale: "fr",
      name: "Ada",
      signInUrl: "https://cortex.test/sign-in",
      resetUrl: "https://cortex.test/forgot-password",
    });

    expect(sent[0]?.subject).toBe("Vous avez déjà un compte Cortex");
    expect(sent[0]?.text).toContain("Réinitialisez-le ici");
    expect(sent[0]?.html).toContain('href="https://cortex.test/forgot-password"');
  });

  it("says a GitHub-only account signs in with GitHub", async () => {
    await sendAccountExistsEmail({
      to: "ada@example.com",
      locale: "en",
      name: null,
      signInUrl: "https://cortex.test/sign-in",
      resetUrl: null,
    });

    expect(sent[0]?.subject).toBe("You already have a Cortex account");
    expect(sent[0]?.text).toContain("It signs in with GitHub.");
    expect(sent[0]?.text).not.toContain("Reset it here");
  });
});

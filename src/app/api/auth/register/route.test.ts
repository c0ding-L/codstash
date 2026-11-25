import { after } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/auth/register/route";
import { getRequestLocale } from "@/i18n/request";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { sendAccountExistsEmail } from "@/lib/email";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { issueVerificationEmail } from "@/lib/verification";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn() } }));
vi.mock("@/i18n/request", () => ({ getRequestLocale: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAccountExistsEmail: vi.fn() }));
vi.mock("@/lib/email-verification-flag", () => ({ isEmailVerificationEnabled: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), create: vi.fn() } } }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/verification", () => ({ issueVerificationEmail: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const findUser = asMock(prisma.user.findUnique);
const createUser = asMock(prisma.user.create);
const requestLocale = asMock(getRequestLocale);

const VALID = { name: "Ada", email: "ada@example.com", password: "long-enough", confirmPassword: "long-enough" };

function register(fields: Record<string, string>) {
  return POST(
    new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(fields) }),
  );
}

beforeEach(() => {
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 2, reset: Date.now() + 60_000 });
  asMock(isEmailVerificationEnabled).mockReturnValue(true);
  requestLocale.mockResolvedValue({ locale: "fr", source: "cookie" });
  findUser.mockResolvedValue(null);
  createUser.mockResolvedValue({ name: "Ada", email: "ada@example.com" });
  asMock(issueVerificationEmail).mockResolvedValue("sent");
  asMock(sendAccountExistsEmail).mockResolvedValue(true);
});

describe("POST /api/auth/register", () => {
  it("words a validation error in French, with the minimum filled in", async () => {
    setTestLocale("fr");

    const response = await register({ ...VALID, password: "short", confirmPassword: "short" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Le mot de passe doit contenir au moins 8 caractères.",
    });
  });

  it("words a too-long name in French, with the maximum filled in", async () => {
    setTestLocale("fr");

    const response = await register({ ...VALID, name: "a".repeat(101) });

    expect(await response.json()).toEqual({ success: false, error: "Le nom ne peut pas dépasser 100 caractères." });
  });

  it("saves the registrant's language on the new account and writes the email in it", async () => {
    const response = await register(VALID);

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "ada@example.com", locale: "fr" }) }),
    );
    expect(issueVerificationEmail).toHaveBeenCalledWith(expect.anything(), { locale: "fr" });
  });

  it("saves no language when nobody chose one, so a new device follows the browser", async () => {
    requestLocale.mockResolvedValue({ locale: "en", source: "default" });

    await register(VALID);

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ locale: null }) }));
  });

  it("writes to an existing account's owner in the owner's language, not the registrant's", async () => {
    asMock(isEmailVerificationEnabled).mockReturnValue(false);
    requestLocale.mockResolvedValue({ locale: "en", source: "cookie" });
    findUser.mockResolvedValue({ email: "ada@example.com", name: "Ada", password: "hash", locale: "fr" });
    vi.stubEnv("APP_URL", "https://cortex.test");

    await register(VALID);
    // The notice runs after the response.
    const [[task]] = asMock(after).mock.calls as [[() => Promise<void>]];
    await task();

    expect(createUser).not.toHaveBeenCalled();
    expect(sendAccountExistsEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com", locale: "fr" }));
  });
});

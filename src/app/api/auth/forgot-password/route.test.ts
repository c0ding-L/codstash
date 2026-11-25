import { after } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/auth/forgot-password/route";
import { getRequestLocale } from "@/i18n/request";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { issuePasswordResetEmail } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/i18n/request", () => ({ getRequestLocale: vi.fn() }));
vi.mock("@/lib/password-reset", () => ({ issuePasswordResetEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;

function forgot(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  );
}

beforeEach(() => {
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 2, reset: Date.now() + 60_000 });
  asMock(getRequestLocale).mockResolvedValue({ locale: "fr", source: "cookie" });
  asMock(issuePasswordResetEmail).mockResolvedValue("sent");
});

describe("POST /api/auth/forgot-password", () => {
  it("words an invalid email in French", async () => {
    setTestLocale("fr");

    const response = await forgot({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: "L’adresse e-mail n’est pas valide." });
  });

  it("reads the language before the response and writes the email in it", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com", name: "Ada", password: "hash" });

    const response = await forgot({ email: "Ada@Example.com" });
    expect(await response.json()).toEqual({ success: true });
    // Read in the request, not inside `after`, where its cookies are gone.
    expect(getRequestLocale).toHaveBeenCalledTimes(1);

    const [[task]] = asMock(after).mock.calls as [[() => Promise<void>]];
    await task();

    expect(getRequestLocale).toHaveBeenCalledTimes(1);
    expect(issuePasswordResetEmail).toHaveBeenCalledWith(expect.objectContaining({ email: "ada@example.com" }), "fr");
  });

  it("answers the same and sends nothing for an unknown address", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue(null);

    const response = await forgot({ email: "nobody@example.com" });
    const [[task]] = asMock(after).mock.calls as [[() => Promise<void>]];
    await task();

    expect(await response.json()).toEqual({ success: true });
    expect(issuePasswordResetEmail).not.toHaveBeenCalled();
  });
});

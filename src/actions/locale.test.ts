import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { setLocale } from "@/actions/locale";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const setCookie = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

const { cookies } = await import("next/headers");

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const updateUser = asMock(prisma.user.update);

beforeEach(() => {
  asMock(cookies).mockResolvedValue({ set: setCookie });
  session.mockResolvedValue({ user: { id: "user_1" } });
  updateUser.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setLocale", () => {
  it("sets the cookie for a year on the whole site", async () => {
    expect(await setLocale("fr")).toEqual({ success: true, error: null });
    expect(setCookie).toHaveBeenCalledWith("NEXT_LOCALE", "fr", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  });

  it("saves the choice on the signed-in user's row", async () => {
    await setLocale("fr");

    expect(updateUser).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { locale: "fr" } });
  });

  it("only sets the cookie when signed out", async () => {
    session.mockResolvedValue(null);

    expect(await setLocale("en")).toEqual({ success: true, error: null });
    expect(setCookie).toHaveBeenCalledWith("NEXT_LOCALE", "en", expect.any(Object));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it.each(["de", "FR", "", "fr-FR"])("refuses %j without touching anything", async (value) => {
    expect(await setLocale(value)).toEqual({ success: false, error: "invalid_locale" });
    expect(setCookie).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports a database failure", async () => {
    updateUser.mockRejectedValue(new Error("down"));

    expect(await setLocale("fr")).toEqual({ success: false, error: "save_failed" });
    expect(setCookie).not.toHaveBeenCalled();
  });
});

import { cookies, headers } from "next/headers";
import type { GetRequestConfigParams, RequestConfig } from "next-intl/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import requestConfig from "@/i18n/request";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const asMock = (fn: unknown) => fn as Mock;

/** The setup file's `getRequestConfig` returns the callback itself. */
const config = requestConfig as unknown as (params: Partial<GetRequestConfigParams>) => Promise<RequestConfig>;

/** A request whose cookie and `Accept-Language` both ask for French. */
beforeEach(() => {
  asMock(cookies).mockResolvedValue({ get: () => ({ value: "fr" }) });
  asMock(headers).mockResolvedValue(new Headers({ "accept-language": "fr" }));
});

describe("getRequestConfig", () => {
  it("follows the request without an explicit locale", async () => {
    expect((await config({})).locale).toBe("fr");
  });

  // The REST API (C2) answers in English whatever the caller's language.
  it("lets an explicit locale win over the request's", async () => {
    const { locale, messages } = await config({ locale: "en" });

    expect(locale).toBe("en");
    expect((messages as { errors: { items: { titleRequired: string } } }).errors.items.titleRequired).toBe(
      "Title is required.",
    );
    expect(cookies).not.toHaveBeenCalled();
  });

  it("ignores an explicit locale it does not support", async () => {
    expect((await config({ locale: "de" as never })).locale).toBe("fr");
  });
});

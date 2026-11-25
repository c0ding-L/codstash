import { describe, expect, it } from "vitest";

import { isLocale, localeFromAcceptLanguage, resolveLocale } from "@/lib/locale";

describe("isLocale", () => {
  it.each(["en", "fr"])("accepts %s", (value) => {
    expect(isLocale(value)).toBe(true);
  });

  it.each(["de", "FR", "fr-FR", "", null, undefined, 1])("refuses %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });
});

describe("localeFromAcceptLanguage", () => {
  it.each([
    ["fr-FR,fr;q=0.9,en;q=0.8", "fr"],
    ["de,en;q=0.5", "en"],
    ["en;q=0.3,fr;q=0.8", "fr"],
    ["fr-CA", "fr"],
    ["FR-sn", "fr"],
    ["en-US,en;q=0.9", "en"],
    ["de, fr;q=0.7 , en;q=0.7", "fr"],
    ["*", null],
    ["de,es", null],
    ["fr;q=0,en;q=0.1", "en"],
    ["fr;q=abc", null],
    ["", null],
  ])("%j gives %j", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  it("handles a missing header", () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
  });
});

describe("resolveLocale", () => {
  it("uses a valid cookie first", () => {
    expect(resolveLocale({ cookie: "fr", userLocale: "en", acceptLanguage: "en" })).toEqual({
      locale: "fr",
      source: "cookie",
    });
  });

  it("skips an invalid cookie", () => {
    expect(resolveLocale({ cookie: "de", acceptLanguage: "fr" })).toEqual({ locale: "fr", source: "header" });
  });

  it("uses the user's saved locale when there is no cookie", () => {
    expect(resolveLocale({ cookie: null, userLocale: "fr", acceptLanguage: "en" })).toEqual({
      locale: "fr",
      source: "user",
    });
  });

  it("ignores an invalid saved locale", () => {
    expect(resolveLocale({ userLocale: "xx", acceptLanguage: "fr-FR" })).toEqual({ locale: "fr", source: "header" });
  });

  it("falls back to the browser language", () => {
    expect(resolveLocale({ acceptLanguage: "fr-SN,fr;q=0.9" })).toEqual({ locale: "fr", source: "header" });
  });

  it("falls back to English", () => {
    expect(resolveLocale({})).toEqual({ locale: "en", source: "default" });
    expect(resolveLocale({ acceptLanguage: "de" })).toEqual({ locale: "en", source: "default" });
  });
});

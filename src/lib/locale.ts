/** The languages the UI ships in. English is the source of every message. */
export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Holds the chosen language; read on every request, written only by `setLocale`. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Where the locale of a request came from. `user` means the cookie is missing and should be written. */
export type LocaleSource = "cookie" | "user" | "header" | "default";

interface ResolveLocaleInput {
  cookie?: string | null;
  userLocale?: string | null;
  acceptLanguage?: string | null;
}

/**
 * Picks the locale for a request: the cookie, then the signed-in user's saved choice, then the
 * browser's `Accept-Language`, then English. Invalid values at any step are skipped.
 */
export function resolveLocale({ cookie, userLocale, acceptLanguage }: ResolveLocaleInput): {
  locale: Locale;
  source: LocaleSource;
} {
  if (isLocale(cookie)) return { locale: cookie, source: "cookie" };
  if (isLocale(userLocale)) return { locale: userLocale, source: "user" };

  const fromHeader = localeFromAcceptLanguage(acceptLanguage);
  if (fromHeader) return { locale: fromHeader, source: "header" };

  return { locale: DEFAULT_LOCALE, source: "default" };
}

/**
 * The supported language the browser ranks highest, or null. Only the primary subtag counts, so
 * `fr-SN` and `fr-CA` both give `fr`. Entries with `q=0` are refused, per RFC 9110.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { language: tag.trim().toLowerCase().split("-")[0] ?? "", q: Number.isFinite(q) ? q : 0, index };
    })
    .filter(({ language, q }) => language !== "" && q > 0)
    // Stable on equal weights: the header's own order breaks ties.
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return ranked.map(({ language }) => language).find(isLocale) ?? null;
}

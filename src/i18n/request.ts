import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { cache } from "react";

import { auth } from "@/auth";
import { LOCALE_COOKIE, resolveLocale, type Locale, type LocaleSource } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

/**
 * The locale of the current request and where it came from. Cached per request, so the root
 * layout, `getRequestConfig` and the app layout's cookie sync share one lookup.
 *
 * The saved `User.locale` is read only when the cookie is missing or invalid and someone is
 * signed in, which happens once per device: the app layout then writes the cookie.
 */
export const getRequestLocale = cache(async (): Promise<{ locale: Locale; source: LocaleSource }> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookie = cookieStore.get(LOCALE_COOKIE)?.value ?? null;
  const acceptLanguage = headerStore.get("accept-language");

  const fromCookie = resolveLocale({ cookie });
  if (fromCookie.source === "cookie") return fromCookie;

  return resolveLocale({ cookie, userLocale: await savedUserLocale(), acceptLanguage });
});

async function savedUserLocale(): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
    return user?.locale ?? null;
  } catch (error) {
    // The language is never worth failing a page for: fall through to the browser's.
    console.error("[i18n] could not read the saved locale:", error);
    return null;
  }
}

/**
 * next-intl's per-request config. No locale routing, so this always returns a locale itself;
 * without one next-intl throws "Unable to find next-intl locale".
 */
export default getRequestConfig(async () => {
  const { locale } = await getRequestLocale();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

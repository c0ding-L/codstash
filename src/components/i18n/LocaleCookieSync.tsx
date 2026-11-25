import { getRequestLocale } from "@/i18n/request";

import { WriteLocaleCookie } from "./WriteLocaleCookie";

/**
 * On a device with no language cookie, a signed-in user's locale comes from `User.locale`, a
 * database read. This writes the cookie once so later requests skip that read. A cookie cannot
 * be set while rendering, hence the client component and its server action.
 */
export async function LocaleCookieSync() {
  const { locale, source } = await getRequestLocale();
  return source === "user" ? <WriteLocaleCookie locale={locale} /> : null;
}

import { createTranslator } from "next-intl";

import type { Locale } from "@/lib/locale";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const CATALOGS = { en, fr } as const;

/**
 * The `emails` messages in one language. Emails render outside any request (`render()` has no
 * Next context), so the catalog is read directly rather than through `getTranslations`.
 */
export function emailTranslator(locale: Locale) {
  return createTranslator({ locale, messages: CATALOGS[locale], namespace: "emails" });
}

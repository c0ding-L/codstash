import { createTranslator } from "next-intl";
import { afterEach, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

/**
 * Loaded by `vitest.config.mts` (`setupFiles`) before every test file. Server code reads its
 * messages through `next-intl/server`, which needs a Next request; tests get a translator over
 * the real catalogs instead, in English unless a test calls `setTestLocale("fr")`.
 *
 * Plain functions, not `vi.fn()`: `mockReset` would wipe an implementation before each test.
 */
let testLocale: "en" | "fr" = "en";

export function setTestLocale(locale: "en" | "fr") {
  testLocale = locale;
}

afterEach(() => {
  testLocale = "en";
});

vi.mock("next-intl/server", () => ({
  getLocale: async () => testLocale,
  // The config callback itself, so `src/i18n/request.ts` can be called in a test.
  getRequestConfig: (create: unknown) => create,
  // A string namespace follows the test locale; `{ locale, namespace }` forces one, as on the server.
  getTranslations: async (arg?: string | { locale: "en" | "fr"; namespace?: string }) => {
    const locale = typeof arg === "object" ? arg.locale : testLocale;
    const namespace = typeof arg === "object" ? arg.namespace : arg;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the namespace is a runtime string here
    return createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as any });
  },
}));

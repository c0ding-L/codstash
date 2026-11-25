"use client";

import { useEffect } from "react";

import { setLocale } from "@/actions/locale";
import type { Locale } from "@/lib/locale";

/** Writes the language cookie once after mount. Nothing to show: the page is already in `locale`. */
export function WriteLocaleCookie({ locale }: { locale: Locale }) {
  useEffect(() => {
    void setLocale(locale);
  }, [locale]);

  return null;
}

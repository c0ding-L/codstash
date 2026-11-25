"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setLocale } from "@/actions/locale";
import type { Locale } from "@/lib/locale";

/**
 * Switches the interface language: saves it, then re-renders the page on the server so every
 * message comes back in the new language. Shared by the settings form and the user menu.
 */
export function useChangeLocale() {
  const current = useLocale();
  const router = useRouter();
  const t = useTranslations("settings.language");
  const [pending, startTransition] = useTransition();

  function change(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      const result = await setLocale(locale);
      if (result.success) router.refresh();
      else toast.error(t("saveFailed"));
    });
  }

  return { locale: current, change, pending };
}

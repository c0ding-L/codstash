"use client";

import { useTranslations } from "next-intl";

import { useChangeLocale } from "@/components/i18n/use-change-locale";
import { LOCALES } from "@/lib/locale";
import { cn } from "@/lib/utils";

/**
 * EN / FR for the signed-out pages. Signed out, `setLocale` only writes the cookie; the page
 * then re-renders in the chosen language.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const { locale, change, pending } = useChangeLocale();

  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center justify-center gap-1 text-xs", className)}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={locale === value}
          disabled={pending}
          onClick={() => change(value)}
          className={cn(
            "rounded-md px-2 py-1 font-medium uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            locale === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

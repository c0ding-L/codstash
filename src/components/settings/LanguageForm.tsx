"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { useChangeLocale } from "@/components/i18n/use-change-locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCALES, type Locale } from "@/lib/locale";

/** The interface language, saved on change like the editor preferences beside it. */
export function LanguageForm() {
  const t = useTranslations();
  const { locale, change, pending } = useChangeLocale();
  const id = useId();
  const items = LOCALES.map((value) => ({ value, label: t(`locales.${value}`) }));

  return (
    <div className="flex items-center justify-between gap-4">
      <label id={id} className="text-sm font-medium">
        {t("settings.language.title")}
      </label>
      <Select
        items={items}
        value={locale}
        disabled={pending}
        onValueChange={(next: Locale | null) => next !== null && change(next)}
      >
        <SelectTrigger aria-labelledby={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

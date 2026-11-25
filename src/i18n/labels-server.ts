import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { typeLabel, type TypeForm, type TypeLike } from "@/i18n/labels";

/** `useItemTypeLabel` for async server components. */
export async function getItemTypeLabel() {
  const t = await getTranslations("itemTypes");
  return (type: TypeLike, form: TypeForm = "one") => typeLabel(t, type, form);
}

type TitleKey =
  | "dashboard.title"
  | "collections.title"
  | "favorites.title"
  | "profile.title"
  | "settings.title"
  | "billing.return.title"
  | "upgrade.title";

/** A page's `metadata`: "Tableau de bord · Cortex", from the page's own heading message. */
export async function pageMetadata(key: TitleKey): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("metadata.page", { page: t(key) }) };
}

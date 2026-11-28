import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { typeLabel, viewType, type TypeForm, type TypeLike } from "@/i18n/labels";
import type { TypeRef } from "@/types/item-type";

/** A type's label for async server components, by slug: the homepage preview's system types. */
export async function getItemTypeLabel() {
  const t = await getTranslations("itemTypes");
  return (type: TypeLike, form: TypeForm = "one") => typeLabel(t, type, form);
}

/** `useTypeView` for async server components. */
export async function getTypeView() {
  const t = await getTranslations("itemTypes");
  return (type: TypeRef, form: TypeForm = "one") => viewType(t, type, form);
}

type TitleKey =
  | "dashboard.title"
  | "collections.title"
  | "favorites.title"
  | "profile.title"
  | "settings.title"
  | "billing.return.title"
  | "upgrade.title"
  | "admin.title";

/** A page's `metadata`: "Tableau de bord · Cortex", from the page's own heading message. */
export async function pageMetadata(key: TitleKey): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("metadata.page", { page: t(key) }) };
}

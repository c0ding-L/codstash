import { useLocale, useTranslations } from "next-intl";

import { copyFromPromise, copyToClipboard } from "@/lib/clipboard";
import { formatFileSize, relativeTime } from "@/lib/format";
import { resolveTypeView, toItemTypeSlug } from "@/lib/item-type-ui";
import type { TypeRef } from "@/types/item-type";

/**
 * Small label helpers over the message catalog, as hooks: they work in client components and in
 * non-async server components. Async server components use `labels-server.ts`.
 */

export interface TypeLike {
  slug: string | null;
  name: string;
}

export type TypeForm = "one" | "other";
export type TypesTranslator = (key: `${NonNullable<ReturnType<typeof toItemTypeSlug>>}.${TypeForm}`) => string;

/** A system type's name in the UI language, by slug; a custom type keeps the name it was given. */
export function typeLabel(t: TypesTranslator, type: TypeLike, form: TypeForm) {
  const slug = type.slug === null ? null : toItemTypeSlug(type.slug);
  return slug ? t(`${slug}.${form}`) : type.name;
}

/** `resolveTypeView` with the system labels in the UI language. A custom type keeps its name. */
export function viewType(t: TypesTranslator, type: TypeRef, form: TypeForm) {
  return resolveTypeView(type, (slug) => t(`${slug}.${form}`));
}

export function useTypeView() {
  const t = useTranslations("itemTypes");
  return (type: TypeRef, form: TypeForm = "one") => viewType(t, type, form);
}

/** "2h ago" / "il y a 2 h", measured against the render's `now`. */
export function useRelativeTime() {
  const t = useTranslations("time");
  return (iso: string, now: string) => {
    const { unit, count } = relativeTime(iso, now);
    return t(unit, { count });
  };
}

/** "2.3 MB" / "2,3 Mo". */
export function useFileSize() {
  const locale = useLocale();
  return (bytes: number) => formatFileSize(bytes, locale);
}

/** The clipboard helpers with their toasts in the UI language. Client components only. */
export function useClipboard() {
  const t = useTranslations("clipboard");
  const messages = { copied: t("copied"), failed: t("failed") };
  return {
    copyToClipboard: (text: string) => copyToClipboard(text, messages),
    copyFromPromise: (text: Promise<string>) => copyFromPromise(text, messages),
  };
}

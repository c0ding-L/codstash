import { Folder, Search, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { getItemTypeLabel } from "@/i18n/labels-server";
import { formatFileSize } from "@/lib/format";
import { colorClasses, typeColors, typeIcons } from "@/lib/item-type-ui";
import { isLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import type { ColorToken } from "@/types/item-type";

import { previewCollections, previewItems, previewTypes, type PreviewText } from "./home-content";

/** Tinted card per type colour; spelled out so Tailwind sees every class. */
const cardClasses: Record<ColorToken, string> = {
  emerald: "border-emerald-400/20 bg-emerald-400/[0.06]",
  amber: "border-amber-400/20 bg-amber-400/[0.06]",
  blue: "border-blue-400/20 bg-blue-400/[0.06]",
  cyan: "border-cyan-400/20 bg-cyan-400/[0.06]",
  rose: "border-rose-400/20 bg-rose-400/[0.06]",
  violet: "border-violet-400/20 bg-violet-400/[0.06]",
  lime: "border-lime-400/20 bg-lime-400/[0.06]",
  orange: "border-orange-400/20 bg-orange-400/[0.06]",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.06]",
  indigo: "border-indigo-400/20 bg-indigo-400/[0.06]",
  brown: "border-[#b9805a]/20 bg-[#b9805a]/[0.06]",
  white: "border-stone-200/20 bg-stone-200/[0.06]",
  slate: "border-slate-400/20 bg-slate-400/[0.06]",
};

/** A small, static copy of the dashboard: types and collections, search, item cards. */
export async function DashboardPreview() {
  const [t, typeLabel, locale] = await Promise.all([getTranslations("home.preview"), getItemTypeLabel(), getLocale()]);
  const text = (value: PreviewText) => {
    if ("key" in value) return t(`text.${value.key}`);
    if ("bytes" in value) return formatFileSize(value.bytes, isLocale(locale) ? locale : undefined);
    return value.literal;
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50"
        aria-hidden
      >
        <aside className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-border bg-neutral-950/60 p-2.5 text-[11px] sm:flex">
          <p className="px-1.5 pb-1 text-[10px] text-muted-foreground/70">{t("types")}</p>
          {previewTypes.map((type) => {
            const Icon = typeIcons[type];
            return (
              <div key={type} className="flex items-center gap-2 rounded px-1.5 py-1 text-neutral-300">
                <Icon className={cn("size-3.5", colorClasses[typeColors[type]])} />
                {typeLabel({ slug: type, name: type }, "other")}
              </div>
            );
          })}
          <p className="mt-2 px-1.5 pb-1 text-[10px] text-muted-foreground/70">{t("collections")}</p>
          {previewCollections.map((key) => (
            <div key={key} className="flex items-center gap-2 px-1.5 py-1 text-neutral-400">
              <Folder className="size-3.5" />
              {t(`text.${key}`)}
            </div>
          ))}
        </aside>

        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <Search className="size-3.5" />
            {t("search")}
            <kbd className="ml-auto font-mono text-[10px]">⌘K</kbd>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-3">
            {previewItems.map((item) => {
              const color = typeColors[item.type];
              const Icon = typeIcons[item.type];
              return (
                <div
                  key={item.id}
                  className={cn("flex flex-col justify-between rounded-lg border p-2.5", cardClasses[color])}
                >
                  <div className="flex items-start justify-between">
                    <Icon className={cn("size-4", colorClasses[color])} />
                    {item.favorite ? <Star className="size-3.5 fill-amber-400 text-amber-400" /> : null}
                  </div>
                  <div>
                    <p className="truncate text-[11px] font-medium text-neutral-100">{text(item.title)}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{text(item.meta)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

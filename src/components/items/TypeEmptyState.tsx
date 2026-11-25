import { useTranslations } from "next-intl";

import { TypeIconTile } from "@/components/items/TypeIconTile";
import { typeColors } from "@/lib/item-type-ui";
import type { ItemTypeSlug } from "@/types/item-type";

/** Shown on a type page with no items: what the type is for. The header's "New" button creates one. */
export function TypeEmptyState({ slug }: { slug: ItemTypeSlug }) {
  const t = useTranslations("itemTypes");
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <TypeIconTile slug={slug} color={typeColors[slug]} className="size-12 rounded-xl" iconClassName="size-6" />
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{t(`${slug}.empty`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`${slug}.description`)}</p>
      </div>
    </div>
  );
}

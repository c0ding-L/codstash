import { useTranslations } from "next-intl";

import { TypeIconTile } from "@/components/items/TypeIconTile";
import type { TypeView } from "@/lib/item-type-ui";

/** Shown on a type page with no items: what the type is for. The header's "New" button creates one. */
export function TypeEmptyState({ view }: { view: TypeView }) {
  const t = useTranslations("itemTypes");
  const slug = view.systemSlug;
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <TypeIconTile icon={view.Icon} color={view.color} className="size-12 rounded-xl" iconClassName="size-6" />
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{slug ? t(`${slug}.empty`) : t("custom.empty", { name: view.label })}</h2>
        <p className="text-sm text-muted-foreground">{slug ? t(`${slug}.description`) : t("custom.description")}</p>
      </div>
    </div>
  );
}

import { Pin, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import { SharedBadge } from "@/components/share/SharedBadge";
import type { DashboardItem } from "@/lib/db/items";
import { useFileSize, useRelativeTime, useTypeView } from "@/i18n/labels";
import { formatCollectionNames } from "@/lib/format";
import { colorClasses } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

/** `now` is passed in so labels measure against the wall clock, not MOCK_NOW. */
export function ItemRow({ item, now }: { item: DashboardItem; now: string }) {
  const t = useTranslations("common");
  const typeView = useTypeView();
  const relativeTime = useRelativeTime();
  const fileSize = useFileSize();
  const collectionNames = formatCollectionNames(item.collections);
  const { Icon, color, label } = typeView(item.type);

  return (
    <li className="relative flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
      <ItemDrawerTrigger item={item} />

      <TypeIconTile icon={Icon} color={color} className="size-8 shrink-0 rounded-lg" iconClassName="size-4" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {item.isShared ? <SharedBadge /> : null}
          {item.isPinned ? (
            <Pin className="size-3 shrink-0 text-muted-foreground" aria-label={t("pinned")} />
          ) : null}
          {item.isFavorite ? (
            <Star
              className="size-3 shrink-0 fill-amber-400 text-amber-400"
              aria-label={t("favorite")}
            />
          ) : null}
        </div>

        {item.description ? (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={cn(colorClasses[color])}>{label}</span>
          {collectionNames ? <span>· {collectionNames}</span> : null}
          {item.fileSize ? <span>· {fileSize(item.fileSize)}</span> : null}
        </div>
      </div>

      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
        {relativeTime(item.updatedAt.toISOString(), now)}
      </span>
    </li>
  );
}

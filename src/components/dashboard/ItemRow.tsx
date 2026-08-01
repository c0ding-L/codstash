import { Clock, Pin, Star } from "lucide-react";

import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { colorClasses, surfaceClasses, typeById, typeIcons } from "@/lib/item-type-ui";
import { collections, type Item } from "@/lib/mock-data";

function collectionName(collectionId: string | null) {
  if (!collectionId) return null;
  return collections.find((c) => c.id === collectionId)?.name ?? null;
}

export function ItemRow({ item }: { item: Item }) {
  const type = typeById(item.typeId);
  const Icon = type ? typeIcons[type.slug] : Clock;
  const parent = collectionName(item.collectionId);

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          type ? surfaceClasses[type.color] : "bg-muted"
        }`}
      >
        <Icon
          className={`size-4 ${type ? colorClasses[type.color] : ""}`}
          aria-hidden
        />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {item.isPinned ? (
            <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
          ) : null}
          {item.isFavorite ? (
            <Star
              className="size-3 shrink-0 fill-amber-400 text-amber-400"
              aria-label="Favorite"
            />
          ) : null}
        </div>

        {item.description ? (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {type ? (
            <span className={colorClasses[type.color]}>{type.name}</span>
          ) : null}
          {parent ? <span>· {parent}</span> : null}
          {item.fileSize ? <span>· {formatFileSize(item.fileSize)}</span> : null}
        </div>
      </div>

      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </li>
  );
}

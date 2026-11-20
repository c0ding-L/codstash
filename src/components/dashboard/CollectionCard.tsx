import { Clock, Star } from "lucide-react";
import Link from "next/link";

import { TypeIconTile } from "@/components/items/TypeIconTile";
import { Card, CardContent } from "@/components/ui/card";
import type { CollectionType, RecentCollection } from "@/lib/db/collections";
import { formatRelativeTime } from "@/lib/format";
import { colorClasses, primaryTypeOf, ringClasses, toColorToken, toItemTypeSlug, washClasses } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

/** A collection card linking to its page, accented by its most used type. `now` is the page's moment. */
export function CollectionCard({ collection, now }: { collection: RecentCollection; now: string }) {
  // Most-used type first, so it sets the card's accent.
  const primary = primaryTypeOf(collection);
  const primaryColor = primary?.color ?? null;

  return (
    <Card className={cn("relative gap-0 transition-shadow", primaryColor && ringClasses[primaryColor])}>
      {/*
        The wash goes on its own layer rather than on the Card: putting
        a `bg-*` utility in the Card's className makes tailwind-merge
        drop `bg-card`, and the tint has to sit *over* that opaque
        surface, not replace it.
      */}
      {primaryColor ? (
        <span className={cn("pointer-events-none absolute inset-0", washClasses[primaryColor])} aria-hidden />
      ) : null}

      {/* An overlay, like `ItemDrawerTrigger`, so the whole card is the link. */}
      <Link
        href={`/collections/${collection.id}`}
        aria-label={`Open ${collection.name}`}
        className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <CardContent className="relative flex h-full flex-col gap-3">
        <div className="flex items-start justify-between">
          <TypeIconTile
            slug={primary?.slug ?? null}
            color={primaryColor}
            className="size-9 rounded-lg"
            iconClassName="size-4"
          />
          {collection.isFavorite ? <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Favorite" /> : null}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{collection.name}</h3>
          {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
        </div>

        {/* Every type in the collection, not just the dominant one. */}
        {collection.types.length > 0 ? <CollectionTypeChips types={collection.types} /> : null}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-1.5">
            {primary ? <span className={cn(primaryColor && colorClasses[primaryColor])}>{primary.name}</span> : null}
            <span className="text-muted-foreground">
              {primary ? "· " : null}
              {collection.itemCount} items
            </span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {formatRelativeTime(collection.updatedAt.toISOString(), now)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** One small tile per type in the collection, with its count for screen readers. */
function CollectionTypeChips({ types }: { types: CollectionType[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {types.map((type) => (
        <li key={type.slug}>
          <TypeIconTile
            slug={toItemTypeSlug(type.slug)}
            color={toColorToken(type.color)}
            className="size-6 rounded-md"
            iconClassName="size-3"
          />
          <span className="sr-only">
            {type.count} {type.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

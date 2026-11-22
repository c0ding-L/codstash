"use client";

import { useId, useMemo, useState } from "react";

import { FavoriteCollectionRow, FavoriteItemRow, FavoritesSection } from "@/components/favorites/FavoritesList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecentCollection } from "@/lib/db/collections";
import type { DashboardItem } from "@/lib/db/items";
import { FAVORITES_SORTS, type FavoritesSort, sortFavoriteCollections, sortFavoriteItems } from "@/lib/favorites-sort";

/** The two favorites sections and the control that sorts them, in the browser. */
export function FavoritesView({
  items,
  collections,
  now,
}: {
  items: DashboardItem[];
  collections: RecentCollection[];
  now: string;
}) {
  const [sort, setSort] = useState<FavoritesSort>("date");
  const sortedItems = useMemo(() => sortFavoriteItems(items, sort), [items, sort]);
  const sortedCollections = useMemo(() => sortFavoriteCollections(collections, sort), [collections, sort]);

  return (
    <div className="flex flex-col gap-8">
      <SortControl value={sort} onChange={setSort} />

      <FavoritesSection title="Items" count={items.length}>
        {sortedItems.length > 0 ? (
          <ul className="flex flex-col">
            {sortedItems.map((item) => (
              <FavoriteItemRow key={item.id} item={item} now={now} />
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1.5 font-mono text-xs text-muted-foreground">No favorite items.</p>
        )}
      </FavoritesSection>

      <FavoritesSection title="Collections" count={collections.length}>
        {sortedCollections.length > 0 ? (
          <ul className="flex flex-col">
            {sortedCollections.map((collection) => (
              <FavoriteCollectionRow key={collection.id} collection={collection} now={now} />
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1.5 font-mono text-xs text-muted-foreground">No favorite collections.</p>
        )}
      </FavoritesSection>
    </div>
  );
}

function SortControl({ value, onChange }: { value: FavoritesSort; onChange: (sort: FavoritesSort) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <label id={id} className="text-muted-foreground">
        Sort by
      </label>
      <Select items={FAVORITES_SORTS} value={value} onValueChange={(next) => next !== null && onChange(next)}>
        <SelectTrigger aria-labelledby={id} size="sm" className="w-28 font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FAVORITES_SORTS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="font-mono text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

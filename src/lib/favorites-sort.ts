/** How `/favorites` orders its rows. "date" is `updatedAt` desc, the order the queries return. */
export type FavoritesSort = "date" | "name" | "type";

export const FAVORITES_SORTS: { value: FavoritesSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
];

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

interface Sortable {
  id: string;
  updatedAt: Date;
}

/** Newest first, then `id` so equal dates keep one order. */
function byDate(a: Sortable, b: Sortable) {
  return b.updatedAt.getTime() - a.updatedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Returns a sorted copy. `typeOf` gives a row's type name, or null for none (an empty
 * collection); rows without a type go last when sorting by type.
 */
function sortRows<T extends Sortable>(
  rows: readonly T[],
  sort: FavoritesSort,
  nameOf: (row: T) => string,
  typeOf: (row: T) => string | null,
): T[] {
  const byName = (a: T, b: T) => collator.compare(nameOf(a), nameOf(b)) || byDate(a, b);

  const compare =
    sort === "name"
      ? byName
      : sort === "type"
        ? (a: T, b: T) => {
            const ta = typeOf(a);
            const tb = typeOf(b);
            if (ta === null || tb === null) return ta === tb ? byName(a, b) : ta === null ? 1 : -1;
            return collator.compare(ta, tb) || byName(a, b);
          }
        : byDate;

  return [...rows].sort(compare);
}

export function sortFavoriteItems<T extends Sortable & { title: string; type: { name: string } }>(
  items: readonly T[],
  sort: FavoritesSort,
): T[] {
  return sortRows(items, sort, (item) => item.title, (item) => item.type.name);
}

/** A collection's type is its most used one (`types[0]`). */
export function sortFavoriteCollections<T extends Sortable & { name: string; types: readonly { name: string }[] }>(
  collections: readonly T[],
  sort: FavoritesSort,
): T[] {
  return sortRows(collections, sort, (c) => c.name, (c) => c.types[0]?.name ?? null);
}

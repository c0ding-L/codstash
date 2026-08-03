import { Clock, Star } from "lucide-react";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { getDemoUserId, getRecentCollections } from "@/lib/db/collections";
import { formatRelativeTime } from "@/lib/format";
import {
  colorClasses,
  ringClasses,
  surfaceClasses,
  toColorToken,
  toItemTypeSlug,
  typeIcons,
  washClasses,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

export async function RecentCollections() {
  // Without this the route still prerenders: a Prisma query is invisible to
  // Next's static analysis, so the rows — and `now` below — would be baked in
  // at build time and never change. `connection()` is what the docs prescribe
  // for a component that needs per-request output without touching cookies or
  // headers.
  await connection();

  const userId = await getDemoUserId();
  const collections = await getRecentCollections(userId);
  // Real rows, so labels measure against the wall clock. The default anchors to
  // MOCK_NOW, which only suits the mock's fixed timestamps.
  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Recent collections</h2>
        <span className="text-sm text-muted-foreground">
          {collections.length} collections
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          // Most-used type first, so it sets the card's accent.
          const [primary] = collection.types;
          const primarySlug = primary ? toItemTypeSlug(primary.slug) : null;
          const primaryColor = primary ? toColorToken(primary.color) : null;
          const Icon = primarySlug ? typeIcons[primarySlug] : Clock;

          return (
            <Card
              key={collection.id}
              className={cn(
                "relative gap-0 transition-shadow",
                primaryColor && ringClasses[primaryColor],
              )}
            >
              {/*
                The wash goes on its own layer rather than on the Card: putting
                a `bg-*` utility in the Card's className makes tailwind-merge
                drop `bg-card`, and the tint has to sit *over* that opaque
                surface, not replace it.
              */}
              {primaryColor ? (
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0",
                    washClasses[primaryColor],
                  )}
                  aria-hidden
                />
              ) : null}

              <CardContent className="relative flex h-full flex-col gap-3">
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      primaryColor ? surfaceClasses[primaryColor] : "bg-muted",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        primaryColor && colorClasses[primaryColor],
                      )}
                      aria-hidden
                    />
                  </span>
                  {collection.isFavorite ? (
                    <Star
                      className="size-4 fill-amber-400 text-amber-400"
                      aria-label="Favorite"
                    />
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{collection.name}</h3>
                  {collection.description ? (
                    <p className="text-sm text-muted-foreground">
                      {collection.description}
                    </p>
                  ) : null}
                </div>

                {/* Every type in the collection, not just the dominant one. */}
                {collection.types.length > 0 ? (
                  <ul className="flex flex-wrap items-center gap-1.5">
                    {collection.types.map((type) => {
                      const slug = toItemTypeSlug(type.slug);
                      const color = toColorToken(type.color);
                      const TypeIcon = slug ? typeIcons[slug] : Clock;

                      return (
                        <li
                          key={type.slug}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-md",
                            color ? surfaceClasses[color] : "bg-muted",
                          )}
                        >
                          <TypeIcon
                            className={cn("size-3", color && colorClasses[color])}
                            aria-hidden
                          />
                          <span className="sr-only">
                            {type.count} {type.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    {primary ? (
                      <span className={cn(primaryColor && colorClasses[primaryColor])}>
                        {primary.name}
                      </span>
                    ) : null}
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
        })}
      </div>
    </section>
  );
}

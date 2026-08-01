import { Clock, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { colorClasses, surfaceClasses, typeById, typeIcons } from "@/lib/item-type-ui";
import { recentCollections } from "@/lib/mock-data";

export function RecentCollections() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Recent collections</h2>
        <span className="text-sm text-muted-foreground">
          {recentCollections.length} collections
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recentCollections.map((collection) => {
          const type = typeById(collection.primaryTypeId);
          const Icon = type ? typeIcons[type.slug] : Clock;
          return (
            <Card key={collection.id} className="gap-0">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between">
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg ${
                      type ? surfaceClasses[type.color] : "bg-muted"
                    }`}
                  >
                    <Icon
                      className={`size-4 ${type ? colorClasses[type.color] : ""}`}
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
                  <p className="text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={type ? colorClasses[type.color] : ""}>
                      {type?.name}
                    </span>
                    <span className="text-muted-foreground">
                      · {collection.itemCount} items
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" aria-hidden />
                    {formatRelativeTime(collection.updatedAt)}
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

import { FolderHeart, FolderOpen, Layers, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/db/stats";

export async function StatsCards({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const [stats, t] = await Promise.all([getDashboardStats(userId), getTranslations("dashboard.stats")]);

  const cards = [
    {
      label: t("items"),
      value: stats.totalItems,
      hint: t("itemsHint"),
      icon: Layers,
    },
    {
      label: t("collections"),
      value: stats.collectionCount,
      hint: t("collectionsHint"),
      icon: FolderOpen,
    },
    {
      label: t("favoriteItems"),
      value: stats.favoriteItemCount,
      hint: t("favoriteItemsHint"),
      icon: Star,
    },
    {
      label: t("favoriteCollections"),
      value: stats.favoriteCollectionCount,
      hint: t("favoriteCollectionsHint"),
      icon: FolderHeart,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map(({ label, value, hint, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </span>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

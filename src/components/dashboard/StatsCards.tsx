import { FolderHeart, FolderOpen, Layers, Star } from "lucide-react";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { getDemoUserId } from "@/lib/db/collections";
import { getDashboardStats } from "@/lib/db/stats";

export async function StatsCards() {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const userId = await getDemoUserId();
  const stats = await getDashboardStats(userId);

  const cards = [
    {
      label: "Items",
      value: stats.totalItems,
      hint: "across all collections",
      icon: Layers,
    },
    {
      label: "Collections",
      value: stats.collectionCount,
      hint: "across all types",
      icon: FolderOpen,
    },
    {
      label: "Favorite items",
      value: stats.favoriteItemCount,
      hint: "starred items",
      icon: Star,
    },
    {
      label: "Favorite collections",
      value: stats.favoriteCollectionCount,
      hint: "pinned collections",
      icon: FolderHeart,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, hint, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </span>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <span className="text-3xl font-semibold tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

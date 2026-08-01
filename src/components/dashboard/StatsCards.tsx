import { FolderHeart, FolderOpen, Layers, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { dashboardStats } from "@/lib/mock-data";

const stats = [
  {
    label: "Items",
    value: dashboardStats.totalItems,
    hint: "across all collections",
    icon: Layers,
  },
  {
    label: "Collections",
    value: dashboardStats.collectionCount,
    hint: "across all types",
    icon: FolderOpen,
  },
  {
    label: "Favorite items",
    value: dashboardStats.favoriteItemCount,
    hint: "starred items",
    icon: Star,
  },
  {
    label: "Favorite collections",
    value: dashboardStats.favoriteCount,
    hint: "pinned collections",
    icon: FolderHeart,
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon }) => (
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

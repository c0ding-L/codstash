import type { Metadata } from "next";

import { PinnedItems } from "@/components/dashboard/PinnedItems";
import { RecentCollections } from "@/components/dashboard/RecentCollections";
import { RecentItems } from "@/components/dashboard/RecentItems";
import { StatsCards } from "@/components/dashboard/StatsCards";

export const metadata: Metadata = {
  title: "Dashboard · Codstash",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your snippets, prompts, notes and more in one dev-first stash.
        </p>
      </div>

      <StatsCards />
      <RecentCollections />

      <div className="grid gap-8 xl:grid-cols-2">
        <PinnedItems />
        <RecentItems />
      </div>
    </div>
  );
}

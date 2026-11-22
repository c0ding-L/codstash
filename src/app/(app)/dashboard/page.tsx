import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PinnedItems } from "@/components/dashboard/PinnedItems";
import { RecentCollections } from "@/components/dashboard/RecentCollections";
import { RecentItems } from "@/components/dashboard/RecentItems";
import { StatsCards } from "@/components/dashboard/StatsCards";

export const metadata: Metadata = {
  title: "Dashboard · Codstash",
};

export default async function DashboardPage() {
  // The proxy already guards `/dashboard`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/dashboard");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your snippets, prompts, notes and more in one dev-first stash.
        </p>
      </div>

      <StatsCards userId={session.user.id} />
      <RecentCollections userId={session.user.id} />

      {/* grid-cols-1 (minmax(0, 1fr)) lets long descriptions truncate instead of widening the page on mobile. */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <PinnedItems userId={session.user.id} />
        <RecentItems userId={session.user.id} />
      </div>
    </div>
  );
}

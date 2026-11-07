import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PinnedItems } from "@/components/dashboard/PinnedItems";
import { RecentCollections } from "@/components/dashboard/RecentCollections";
import { RecentItems } from "@/components/dashboard/RecentItems";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ItemDrawerProvider } from "@/components/items/ItemDrawerProvider";

export const metadata: Metadata = {
  title: "Dashboard · Codstash",
};

export default async function DashboardPage() {
  // The proxy already guards `/dashboard`; this also narrows the session's type.
  // The item lists use the session because the drawer's route checks ownership
  // against it. The other sections still read the demo account.
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

      <StatsCards />
      <RecentCollections />

      <ItemDrawerProvider>
        <div className="grid gap-8 xl:grid-cols-2">
          <PinnedItems userId={session.user.id} />
          <RecentItems userId={session.user.id} />
        </div>
      </ItemDrawerProvider>
    </div>
  );
}

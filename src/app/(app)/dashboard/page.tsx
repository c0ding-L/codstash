import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { PinnedItems } from "@/components/dashboard/PinnedItems";
import { RecentCollections } from "@/components/dashboard/RecentCollections";
import { RecentItems } from "@/components/dashboard/RecentItems";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { pageMetadata } from "@/i18n/labels-server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("dashboard.title");
}

export default async function DashboardPage() {
  // The proxy already guards `/dashboard`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/dashboard");
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
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

import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ItemRowSection } from "@/components/dashboard/ItemRowSection";
import { getRecentItems } from "@/lib/db/items";

export async function RecentItems({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const [{ items, totalCount }, t] = await Promise.all([getRecentItems(userId), getTranslations("dashboard")]);

  return (
    <ItemRowSection
      icon={Clock}
      title={t("recentItems")}
      items={items}
      aside={
        items.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {t("recentItemsCount", { shown: items.length, total: totalCount })}
          </span>
        ) : null
      }
      empty={<p className="text-sm text-muted-foreground">{t("noItems")}</p>}
    />
  );
}

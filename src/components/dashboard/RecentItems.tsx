import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { getRecentItems } from "@/lib/db/items";

export async function RecentItems({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const [{ items, totalCount }, t] = await Promise.all([getRecentItems(userId), getTranslations("dashboard")]);
  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          {t("recentItems")}
        </h2>
        {items.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {t("recentItemsCount", { shown: items.length, total: totalCount })}
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noItems")}</p>
      )}
    </section>
  );
}

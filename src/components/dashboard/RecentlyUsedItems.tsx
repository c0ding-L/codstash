import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ItemRow } from "@/components/dashboard/ItemRow";
import { getRecentlyUsedItems } from "@/lib/db/items";

/** The items last copied, downloaded or opened (A5). Nothing at all until one has been used. */
export async function RecentlyUsedItems({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const items = await getRecentlyUsedItems(userId);
  if (items.length === 0) return null;

  const now = new Date().toISOString();
  const t = await getTranslations("dashboard");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <History className="size-4 text-muted-foreground" aria-hidden />
        {t("recentlyUsed")}
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

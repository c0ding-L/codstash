import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ItemRowSection } from "@/components/dashboard/ItemRowSection";
import { getRecentlyUsedItems } from "@/lib/db/items";

/** The items last copied, downloaded or opened (A5). Nothing at all until one has been used. */
export async function RecentlyUsedItems({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const items = await getRecentlyUsedItems(userId);
  if (items.length === 0) return null;

  const t = await getTranslations("dashboard");
  return <ItemRowSection icon={History} title={t("recentlyUsed")} items={items} />;
}

import { Pin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ItemRowSection } from "@/components/dashboard/ItemRowSection";
import { getPinnedItems } from "@/lib/db/items";

export async function PinnedItems({ userId }: { userId: string }) {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  const items = await getPinnedItems(userId);

  // The spec asks for nothing at all when nothing is pinned — heading included,
  // replacing the "Nothing pinned yet." placeholder this used to render.
  if (items.length === 0) return null;

  const t = await getTranslations("dashboard");
  return <ItemRowSection icon={Pin} title={t("pinnedItems")} items={items} />;
}

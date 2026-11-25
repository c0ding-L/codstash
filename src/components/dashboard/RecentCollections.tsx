import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getRecentCollections } from "@/lib/db/collections";

export async function RecentCollections({ userId }: { userId: string }) {
  // Without this the route still prerenders: a Prisma query is invisible to
  // Next's static analysis, so the rows — and `now` below — would be baked in
  // at build time and never change. `connection()` is what the docs prescribe
  // for a component that needs per-request output without touching cookies or
  // headers.
  await connection();

  const [collections, t] = await Promise.all([getRecentCollections(userId), getTranslations("dashboard")]);
  // Real rows, so labels measure against the wall clock. The default anchors to
  // MOCK_NOW, which only suits the mock's fixed timestamps.
  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t("recentCollections")}</h2>
        <span className="text-sm text-muted-foreground">
          {t("collectionCount", { count: collections.length })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} now={now} />
        ))}
      </div>
    </section>
  );
}

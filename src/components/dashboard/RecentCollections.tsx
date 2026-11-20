import { connection } from "next/server";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getDemoUserId, getRecentCollections } from "@/lib/db/collections";

export async function RecentCollections() {
  // Without this the route still prerenders: a Prisma query is invisible to
  // Next's static analysis, so the rows — and `now` below — would be baked in
  // at build time and never change. `connection()` is what the docs prescribe
  // for a component that needs per-request output without touching cookies or
  // headers.
  await connection();

  const userId = await getDemoUserId();
  const collections = await getRecentCollections(userId);
  // Real rows, so labels measure against the wall clock. The default anchors to
  // MOCK_NOW, which only suits the mock's fixed timestamps.
  const now = new Date().toISOString();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Recent collections</h2>
        <span className="text-sm text-muted-foreground">
          {collections.length} collections
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

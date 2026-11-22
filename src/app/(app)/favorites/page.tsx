import { Star } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { getFavoriteCollectionCards } from "@/lib/db/collections";
import { getFavoriteItems } from "@/lib/db/items";

export const metadata: Metadata = {
  title: "Favorites · Codstash",
};

export default async function FavoritesPage() {
  // A Prisma query does not opt the route out of prerendering on its own.
  await connection();

  // The proxy already guards `/favorites`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/favorites");

  const [items, collections] = await Promise.all([
    getFavoriteItems(session.user.id),
    getFavoriteCollectionCards(session.user.id),
  ]);
  const now = new Date().toISOString();

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
          Favorites
        </h1>
        <p className="text-sm text-muted-foreground">Starred items and collections.</p>
      </div>

      {items.length === 0 && collections.length === 0 ? (
        <p className="border-y border-border py-8 text-center font-mono text-sm text-muted-foreground">
          No favorites yet. Star an item or a collection to see it here.
        </p>
      ) : (
        <FavoritesView items={items} collections={collections} now={now} />
      )}
    </div>
  );
}

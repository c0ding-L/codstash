import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { CollectionHeaderActions } from "@/components/collections/CollectionHeaderActions";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemDrawerProvider } from "@/components/items/ItemDrawerProvider";
import { getCollection } from "@/lib/db/collections";
import { getItemsByCollection } from "@/lib/db/items";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return {};
  const collection = await getCollection(session.user.id, (await params).id);
  return collection ? { title: `${collection.name} · Codstash` } : {};
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  // Rendered per request, like every other page.
  await connection();

  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/collections/${encodeURIComponent(id)}`);

  // `layout.tsx` has already answered 404; the cached lookup narrows the type here.
  const collection = await getCollection(session.user.id, id);
  if (!collection) notFound();

  const { items, totalCount } = await getItemsByCollection(session.user.id, collection.id);
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{collection.name}</h1>
          {collection.description ? (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {items.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {items.length} of {totalCount}
            </span>
          ) : null}
          <CollectionHeaderActions collection={collection} />
        </div>
      </div>

      {items.length > 0 ? (
        <ItemDrawerProvider>
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} now={now} />
              </li>
            ))}
          </ul>
        </ItemDrawerProvider>
      ) : (
        <p className="text-sm text-muted-foreground">No items in this collection yet.</p>
      )}
    </div>
  );
}

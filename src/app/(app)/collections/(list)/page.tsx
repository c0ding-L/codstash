import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getCollections } from "@/lib/db/collections";

export const metadata: Metadata = {
  title: "Collections · Codstash",
};

export default async function CollectionsPage() {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/collections`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/collections");

  const collections = await getCollections(session.user.id);
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        {collections.length > 0 ? (
          <span className="text-sm text-muted-foreground">{collections.length} collections</span>
        ) : null}
      </div>

      {collections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} now={now} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No collections yet.</p>
      )}
    </div>
  );
}

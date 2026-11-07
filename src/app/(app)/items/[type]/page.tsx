import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { ItemCard } from "@/components/items/ItemCard";
import { getItemsByType } from "@/lib/db/items";
import { itemTypeFromSegment, itemTypeHref, typePluralNames } from "@/lib/item-type-ui";

interface ItemsPageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: ItemsPageProps): Promise<Metadata> {
  const slug = itemTypeFromSegment((await params).type);
  return slug ? { title: `${typePluralNames[slug]} · Codstash` } : {};
}

export default async function ItemsPage({ params }: ItemsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // `layout.tsx` has already answered 404 for an unknown type. This narrows the slug.
  const slug = itemTypeFromSegment((await params).type);
  if (!slug) notFound();

  // The proxy already guards `/items`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${itemTypeHref(slug)}`);

  const { items, totalCount } = await getItemsByType(session.user.id, slug);
  const label = typePluralNames[slug];
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{label}</h1>
        {items.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {items.length} of {totalCount}
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>
      )}
    </div>
  );
}

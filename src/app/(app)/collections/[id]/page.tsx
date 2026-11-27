import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { auth } from "@/auth";
import { Pagination } from "@/components/Pagination";
import { CollectionHeaderActions } from "@/components/collections/CollectionHeaderActions";
import { ItemCard } from "@/components/items/ItemCard";
import { SharedBadge } from "@/components/share/SharedBadge";
import { getCollection } from "@/lib/db/collections";
import { getItemsByCollection } from "@/lib/db/items";
import { ITEMS_PER_PAGE, pageCount, pageOffset, parsePageParam } from "@/lib/pagination";

/** Server actions take the page's limit: Suggest Tags and Description wait on a slow free model. */
export const maxDuration = 60;

interface CollectionPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return {};
  const collection = await getCollection(session.user.id, (await params).id);
  if (!collection) return {};
  const t = await getTranslations("metadata");
  return { title: t("page", { page: collection.name }) };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  // Rendered per request, like every other page.
  await connection();

  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/collections/${encodeURIComponent(id)}`);

  // `layout.tsx` has already answered 404; the cached lookup narrows the type here.
  const collection = await getCollection(session.user.id, id);
  if (!collection) notFound();

  // A page that is not a number, or past the last one, does not exist.
  const page = parsePageParam((await searchParams).page);
  if (page === null) notFound();

  const { items, totalCount } = await getItemsByCollection(session.user.id, collection.id, page);
  const pages = pageCount(totalCount, ITEMS_PER_PAGE);
  if (page > pages) notFound();
  const first = pageOffset(page, ITEMS_PER_PAGE) + 1;
  const now = new Date().toISOString();
  const t = await getTranslations("collections");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{collection.name}</h1>
            {collection.isShared ? <SharedBadge className="size-4" /> : null}
          </div>
          {collection.description ? (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {items.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("range", { first, last: first + items.length - 1, total: totalCount })}
            </span>
          ) : null}
          <CollectionHeaderActions collection={collection} />
        </div>
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
        <p className="text-sm text-muted-foreground">{t("noItems")}</p>
      )}

      <Pagination
        basePath={`/collections/${encodeURIComponent(collection.id)}`}
        page={page}
        pageCount={pages}
        rowIds={items.map((item) => item.id)}
      />
    </div>
  );
}

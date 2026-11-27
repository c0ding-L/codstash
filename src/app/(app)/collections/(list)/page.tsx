import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { auth } from "@/auth";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { Pagination } from "@/components/Pagination";
import { getCollectionsPage } from "@/lib/db/collections";
import { COLLECTIONS_PER_PAGE, pageCount, pageOffset, parsePageParam } from "@/lib/pagination";
import { pageMetadata } from "@/i18n/labels-server";

/** Server actions take the page's limit: Suggest Tags and Description wait on a slow free model. */
export const maxDuration = 60;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("collections.title");
}

interface CollectionsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/collections`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/collections");

  // A page that is not a number, or past the last one, does not exist.
  const page = parsePageParam((await searchParams).page);
  if (page === null) notFound();

  const { collections, totalCount } = await getCollectionsPage(session.user.id, page);
  const pages = pageCount(totalCount, COLLECTIONS_PER_PAGE);
  if (page > pages) notFound();
  const first = pageOffset(page, COLLECTIONS_PER_PAGE) + 1;
  const now = new Date().toISOString();
  const t = await getTranslations("collections");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {collections.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {t("range", { first, last: first + collections.length - 1, total: totalCount })}
          </span>
        ) : null}
      </div>

      {collections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} now={now} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <Pagination
        basePath="/collections"
        page={page}
        pageCount={pages}
        rowIds={collections.map((collection) => collection.id)}
      />
    </div>
  );
}

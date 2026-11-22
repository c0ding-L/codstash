import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { Pagination } from "@/components/Pagination";
import { getCollectionsPage } from "@/lib/db/collections";
import { COLLECTIONS_PER_PAGE, pageCount, pageOffset, parsePageParam } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Collections · Codstash",
};

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        {collections.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {first}–{first + collections.length - 1} of {totalCount}
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
        <p className="text-sm text-muted-foreground">No collections yet.</p>
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

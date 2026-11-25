import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { auth } from "@/auth";
import { Pagination } from "@/components/Pagination";
import { CommandList } from "@/components/items/CommandList";
import { FileList } from "@/components/items/FileList";
import { ImageCard } from "@/components/items/ImageCard";
import { ItemCard } from "@/components/items/ItemCard";
import { LinkList } from "@/components/items/LinkList";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { PromptList } from "@/components/items/PromptList";
import { SnippetList } from "@/components/items/SnippetList";
import { TypeEmptyState } from "@/components/items/TypeEmptyState";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import { getPlanStatus } from "@/lib/db/billing";
import { getCommandTexts, getItemsByType, getPromptPreviews, getSnippetPreviews } from "@/lib/db/items";
import { itemTypeFromSegment, itemTypeHref, typeColors } from "@/lib/item-type-ui";
import { loadAiAllowed } from "@/lib/load-ai-allowed";
import { loadUploadsAllowed } from "@/lib/load-uploads-allowed";
import { ITEMS_PER_PAGE, pageCount, pageOffset, parsePageParam } from "@/lib/pagination";
import { canUploadFiles } from "@/lib/usage-limits";

interface ItemsPageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: ItemsPageProps): Promise<Metadata> {
  const slug = itemTypeFromSegment((await params).type);
  if (!slug) return {};
  const [t, tm] = await Promise.all([getTranslations("itemTypes"), getTranslations("metadata")]);
  return { title: tm("page", { page: t(`${slug}.other`) }) };
}

export default async function ItemsPage({ params, searchParams }: ItemsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // `layout.tsx` has already answered 404 for an unknown type. This narrows the slug.
  const slug = itemTypeFromSegment((await params).type);
  if (!slug) notFound();

  // The proxy already guards `/items`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${itemTypeHref(slug)}`);

  // A page that is not a number, or past the last one, does not exist.
  const page = parsePageParam((await searchParams).page);
  if (page === null) notFound();

  // Files and images are Pro-only: Free users go to the upgrade page, even with
  // items kept from an expired Pro period.
  const isUploadType = slug === "file" || slug === "image";
  if (isUploadType && !canUploadFiles(await getPlanStatus(session.user.id))) redirect("/upgrade");

  const { items, totalCount } = await getItemsByType(session.user.id, slug, page);
  const pages = pageCount(totalCount, ITEMS_PER_PAGE);
  if (page > pages) notFound();
  const first = pageOffset(page, ITEMS_PER_PAGE) + 1;

  const ids = items.map((item) => item.id);
  const commandTexts = slug === "command" ? await getCommandTexts(session.user.id, ids) : {};
  const promptPreviews = slug === "prompt" ? await getPromptPreviews(session.user.id, ids) : {};
  const snippetPreviews = slug === "snippet" ? await getSnippetPreviews(session.user.id, ids) : {};
  const t = await getTranslations();
  const label = t(`itemTypes.${slug}.other`);
  const color = typeColors[slug];
  const now = new Date().toISOString();
  // For the New Item dialog's type picker. Only Pro users reach the upload pages;
  // the others read the plan without waiting, as the layout does for the top bar.
  const uploadsAllowed = isUploadType ? Promise.resolve(true) : loadUploadsAllowed();
  const aiAllowed = loadAiAllowed();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <TypeIconTile slug={slug} color={color} className="size-9 shrink-0 rounded-lg" iconClassName="size-5" />
          {label}
        </h1>
        <div className="flex items-center gap-4">
          {items.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("items.range", { first, last: first + items.length - 1, total: totalCount })}
            </span>
          ) : null}
          <NewItemDialog
            uploadsAllowed={uploadsAllowed}
            aiAllowed={aiAllowed}
            label={t(`itemTypes.${slug}.new`)}
            iconOnlyOnMobile={false}
          />
        </div>
      </div>

      {items.length > 0 ? (
        <>
          {slug === "command" ? (
            <CommandList items={items} texts={commandTexts} now={now} />
          ) : slug === "file" ? (
            <FileList items={items} now={now} />
          ) : slug === "snippet" ? (
            <SnippetList items={items} previews={snippetPreviews} now={now} />
          ) : slug === "prompt" ? (
            <PromptList items={items} previews={promptPreviews} now={now} />
          ) : slug === "link" ? (
            <LinkList items={items} />
          ) : slug === "image" ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <ImageCard item={item} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} now={now} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <TypeEmptyState slug={slug} />
      )}

      <Pagination basePath={itemTypeHref(slug)} page={page} pageCount={pages} rowIds={ids} />
    </div>
  );
}

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
import { getTypeView } from "@/i18n/labels-server";
import { getPlanStatus } from "@/lib/db/billing";
import { resolveTypeSegment, type TypeSegment } from "@/lib/db/item-types";
import { getCommandTexts, getItemsByType, getPromptPreviews, getSnippetPreviews } from "@/lib/db/items";
import { itemTypeFromSegment } from "@/lib/item-type-ui";
import { loadAiAllowed } from "@/lib/load-ai-allowed";
import { loadCustomTypes } from "@/lib/load-custom-types";
import { loadUploadsAllowed } from "@/lib/load-uploads-allowed";
import { ITEMS_PER_PAGE, pageCount, pageOffset, parsePageParam } from "@/lib/pagination";
import { canUploadFiles } from "@/lib/usage-limits";

interface ItemsPageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** The system type of a URL segment without the database; else the user's custom type, if any. */
async function segmentFor(segment: string): Promise<TypeSegment | null> {
  const slug = itemTypeFromSegment(segment);
  if (slug) return { kind: "system", slug };
  await connection();
  const session = await auth();
  return session?.user?.id ? resolveTypeSegment(session.user.id, segment) : null;
}

export async function generateMetadata({ params }: ItemsPageProps): Promise<Metadata> {
  const resolved = await segmentFor((await params).type);
  if (!resolved) return {};
  const [t, tm] = await Promise.all([getTranslations("itemTypes"), getTranslations("metadata")]);
  const page = resolved.kind === "system" ? t(`${resolved.slug}.other`) : resolved.type.name;
  return { title: tm("page", { page }) };
}

export default async function ItemsPage({ params, searchParams }: ItemsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/items`; this also narrows the session's type.
  const segment = (await params).type;
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/items/${encodeURIComponent(segment)}`);

  // `layout.tsx` has already answered 404 for an unknown type. This narrows it.
  const resolved = await resolveTypeSegment(session.user.id, segment);
  if (!resolved) notFound();
  // A custom type lists like notes, with the generic card.
  const slug = resolved.kind === "system" ? resolved.slug : null;
  const typeView = await getTypeView();
  const view = typeView(
    resolved.kind === "system"
      ? { slug: resolved.slug, name: resolved.slug, icon: null, color: null, isSystem: true }
      : resolved.type,
    "other",
  );

  // A page that is not a number, or past the last one, does not exist.
  const page = parsePageParam((await searchParams).page);
  if (page === null) notFound();

  // Files and images are Pro-only: Free users go to the upgrade page, even with
  // items kept from an expired Pro period.
  const isUploadType = slug === "file" || slug === "image";
  if (isUploadType && !canUploadFiles(await getPlanStatus(session.user.id))) redirect("/upgrade");

  const { items, totalCount } = await getItemsByType(
    session.user.id,
    resolved.kind === "system" ? { slug: resolved.slug } : { customTypeId: resolved.type.id },
    page,
  );
  const pages = pageCount(totalCount, ITEMS_PER_PAGE);
  if (page > pages) notFound();
  const first = pageOffset(page, ITEMS_PER_PAGE) + 1;

  const ids = items.map((item) => item.id);
  const commandTexts = slug === "command" ? await getCommandTexts(session.user.id, ids) : {};
  const promptPreviews = slug === "prompt" ? await getPromptPreviews(session.user.id, ids) : {};
  const snippetPreviews = slug === "snippet" ? await getSnippetPreviews(session.user.id, ids) : {};
  const t = await getTranslations();
  const now = new Date().toISOString();
  // For the New Item dialog's type picker. Only Pro users reach the upload pages;
  // the others read the plan without waiting, as the layout does for the top bar.
  const uploadsAllowed = isUploadType ? Promise.resolve(true) : loadUploadsAllowed();
  const aiAllowed = loadAiAllowed();
  const customTypes = loadCustomTypes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <TypeIconTile icon={view.Icon} color={view.color} className="size-9 shrink-0 rounded-lg" iconClassName="size-5" />
          {view.label}
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
            customTypes={customTypes}
            label={slug ? t(`itemTypes.${slug}.new`) : t("itemTypes.custom.new", { name: view.label })}
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
        <TypeEmptyState view={view} />
      )}

      <Pagination basePath={view.href} page={page} pageCount={pages} rowIds={ids} />
    </div>
  );
}

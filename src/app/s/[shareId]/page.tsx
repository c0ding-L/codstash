import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import ReactMarkdown from "react-markdown";

import { SharedItemView } from "@/components/share/SharedItemView";
import { Separator } from "@/components/ui/separator";
import { getSharedCollection } from "@/lib/db/share";
import { isShareId, visibleSharedItems } from "@/lib/share";

interface SharedCollectionPageProps {
  params: Promise<{ shareId: string }>;
}

async function load(shareId: string) {
  return isShareId(shareId) ? getSharedCollection(shareId) : null;
}

export async function generateMetadata({ params }: SharedCollectionPageProps): Promise<Metadata> {
  const collection = await load((await params).shareId);
  if (!collection) return { robots: { index: false, follow: false } };
  const t = await getTranslations("metadata");
  return {
    title: t("page", { page: collection.name }),
    description: (collection.description ?? "").slice(0, 160) || undefined,
    robots: { index: collection.indexable, follow: collection.indexable },
  };
}

/** Groups the items by type, in the order each type first appears (most recently updated first). */
function groupByType<T extends { type: { slug: string } }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.type.slug) ?? [];
    group.push(item);
    groups.set(item.type.slug, group);
  }
  return [...groups.values()];
}

/**
 * A shared collection, public and read-only (D1): its text items and links, grouped by type.
 * Items that now look like secrets are left out at render time.
 */
export default async function SharedCollectionPage({ params }: SharedCollectionPageProps) {
  await connection();
  const collection = await load((await params).shareId);
  if (!collection) notFound();
  const t = await getTranslations("publicShare");
  const tc = await getTranslations("common");
  const items = visibleSharedItems(collection.items);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold break-words">{collection.name}</h1>
        {collection.description ? (
          // Markdown without raw HTML; plain text here, so no links are rendered.
          <div className="text-muted-foreground">
            <ReactMarkdown allowedElements={["p", "strong", "em", "code", "br"]} unwrapDisallowed>
              {collection.description}
            </ReactMarkdown>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {tc("itemCount", { count: items.length })}
          {collection.ownerName ? ` · ${t("sharedBy", { name: collection.ownerName })}` : null}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        groupByType(items).map((group, index) => (
          <section key={group[0]!.type.slug} className="flex flex-col gap-8">
            {index > 0 ? <Separator /> : null}
            {group.map((item) => (
              <SharedItemView key={item.id} item={item} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

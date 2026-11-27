import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { SharedItemView } from "@/components/share/SharedItemView";
import { getSharedItem } from "@/lib/db/share";
import { isShareId } from "@/lib/share";

interface SharedItemPageProps {
  params: Promise<{ shareId: string }>;
}

/** The same lookup as the page (cached per request); null for anything the page answers 404 to. */
async function load(shareId: string) {
  return isShareId(shareId) ? getSharedItem(shareId) : null;
}

export async function generateMetadata({ params }: SharedItemPageProps): Promise<Metadata> {
  const item = await load((await params).shareId);
  if (!item) return { robots: { index: false, follow: false } };
  const t = await getTranslations("metadata");
  return {
    title: t("page", { page: item.title }),
    description: (item.description ?? "").slice(0, 160) || undefined,
    robots: { index: item.indexable, follow: item.indexable },
  };
}

/**
 * One shared item, public and read-only (D1). Unknown, revoked, a file, or now holding a likely
 * secret: the same 404 for all of them.
 */
export default async function SharedItemPage({ params }: SharedItemPageProps) {
  await connection();
  const item = await load((await params).shareId);
  if (!item) notFound();
  const t = await getTranslations("publicShare");

  return (
    <div className="flex flex-col gap-4">
      <SharedItemView item={item} headingLevel={1} />
      {item.ownerName ? <p className="text-sm text-muted-foreground">{t("sharedBy", { name: item.ownerName })}</p> : null}
    </div>
  );
}

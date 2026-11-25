"use client";

import { CodeEditor } from "@/components/items/CodeEditor";
import type { ItemDetailState } from "@/components/items/ItemDetails";
import { ItemFileCard } from "@/components/items/ItemFileCard";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { isCodeType } from "@/lib/code-language";
import { isWebUrl } from "@/lib/utils";
import type { ItemTypeSlug } from "@/types/item-type";

/** The body of the item: the part of the drawer that waits for the fetch. */
export function ItemBody({
  itemId,
  fileSize,
  state,
  slug,
  aiAllowed,
}: {
  itemId: string;
  fileSize: number | null;
  state: ItemDetailState;
  slug: ItemTypeSlug | null;
  /** For the code editor's Explain button. */
  aiAllowed: Promise<boolean>;
}) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading item">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-muted-foreground">
        The rest of this item could not be loaded.
      </p>
    );
  }

  const { content, language, url, fileName } = state.detail;
  // Served by the app from the private bucket, for the owner only.
  const fileHref = `/api/items/${encodeURIComponent(itemId)}/download`;

  return (
    <>
      {fileName && slug === "image" ? (
        // From the download route, which next/image's optimiser could not reach with the session.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileHref}
          alt={fileName}
          className="max-h-80 w-full shrink-0 rounded-lg border border-border bg-muted/30 object-contain"
        />
      ) : null}

      {fileName ? (
        <ItemFileCard href={fileHref} fileName={fileName} fileSize={fileSize} isImage={slug === "image"} />
      ) : null}

      {content && isCodeType(slug) ? (
        // Keyed by item, so an explanation never carries over to another item.
        <CodeEditor
          key={itemId}
          value={content}
          language={language}
          ariaLabel="Content"
          explain={{ itemId, aiAllowed }}
        />
      ) : content ? (
        <MarkdownEditor value={content} ariaLabel="Content" />
      ) : null}

      {url ? (
        isWebUrl(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-4"
          >
            {url}
          </a>
        ) : (
          <p className="break-all">{url}</p>
        )
      ) : null}
    </>
  );
}

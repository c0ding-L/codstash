"use client";

import { Clock, Copy, Pencil, Pin, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { formatFileSize } from "@/lib/format";
import { colorClasses, toColorToken, toItemTypeSlug, typeIcons } from "@/lib/item-type-ui";
import { cn, isWebUrl } from "@/lib/utils";

export type ItemDetailState =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetailJson }
  | { status: "error" };

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}

/**
 * Only Copy works so far: no item mutations exist yet. Favorite and Pin stay at
 * full opacity while disabled, because they still report the item's current state.
 */
function ActionBar({ card, copyText }: { card: DashboardItem; copyText: string | null }) {
  return (
    <div className="flex items-center gap-1 border-y border-border px-4 py-2">
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Favorite"
        aria-pressed={card.isFavorite}
        className={cn(card.isFavorite && "disabled:opacity-100")}
      >
        <Star className={cn(card.isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Pin"
        aria-pressed={card.isPinned}
        className={cn(card.isPinned && "disabled:opacity-100")}
      >
        <Pin className={cn(card.isPinned && "fill-current")} aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!copyText}
        aria-label="Copy"
        onClick={() => {
          if (copyText) void copyToClipboard(copyText);
        }}
      >
        <Copy aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" disabled aria-label="Edit">
        <Pencil aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" disabled aria-label="Delete" className="ml-auto">
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

/** The body of the item: the part of the drawer that waits for the fetch. */
function ItemBody({ state }: { state: ItemDetailState }) {
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

  const { content, url } = state.detail;

  return (
    <>
      {content ? (
        <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs break-words whitespace-pre-wrap">
          {content}
        </pre>
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

export function ItemDetails({ card, state }: { card: DashboardItem; state: ItemDetailState }) {
  const slug = toItemTypeSlug(card.type.slug);
  const color = toColorToken(card.type.color);
  const Icon = slug ? typeIcons[slug] : Clock;
  const detail = state.status === "ready" ? state.detail : null;

  return (
    <>
      <ActionBar card={card} copyText={detail ? detail.content || detail.url : null} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {card.description ? <p className="text-muted-foreground">{card.description}</p> : null}

        <ItemBody state={state} />

        <Separator />

        <dl className="flex flex-col gap-2">
          <DetailRow label="Type">
            <span className={cn("inline-flex items-center gap-1.5", color && colorClasses[color])}>
              <Icon className="size-3.5" aria-hidden />
              {card.type.name}
            </span>
          </DetailRow>
          {card.collectionName ? <DetailRow label="Collection">{card.collectionName}</DetailRow> : null}
          {detail?.language ? <DetailRow label="Language">{detail.language}</DetailRow> : null}
          {detail?.fileName ? <DetailRow label="File">{detail.fileName}</DetailRow> : null}
          {card.fileSize ? <DetailRow label="Size">{formatFileSize(card.fileSize)}</DetailRow> : null}
          {state.status === "loading" ? (
            <>
              <DetailRow label="Tags">
                <Skeleton className="h-4 w-16" />
              </DetailRow>
              <DetailRow label="Created">
                <Skeleton className="h-4 w-20" />
              </DetailRow>
            </>
          ) : null}
          {detail ? (
            <>
              <DetailRow label="Tags">
                {detail.tags.length > 0 ? (
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    {detail.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </DetailRow>
              <DetailRow label="Created">{formatDate(detail.createdAt)}</DetailRow>
            </>
          ) : null}
          <DetailRow label="Updated">{formatDate(card.updatedAt)}</DetailRow>
        </dl>
      </div>
    </>
  );
}

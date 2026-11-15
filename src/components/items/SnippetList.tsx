import { Pin, Star } from "lucide-react";

import { ItemCopyButton } from "@/components/items/ItemCopyButton";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import type { DashboardItem, SnippetPreview } from "@/lib/db/items";
import { formatRelativeTime } from "@/lib/format";
import { highlightCode } from "@/lib/highlight";

interface SnippetListProps {
  items: DashboardItem[];
  previews: Record<string, SnippetPreview>;
  /** Passed in so every row measures against the same moment. */
  now: string;
}

const EMPTY_PREVIEW: SnippetPreview = { code: "", lineCount: 0, language: null, tags: [] };

/** The snippet list: each snippet's details beside the start of its code, highlighted on the server. */
export async function SnippetList({ items, previews, now }: SnippetListProps) {
  const rows = await Promise.all(
    items.map(async (item) => {
      const preview = previews[item.id] ?? EMPTY_PREVIEW;
      const html = preview.code ? await highlightCode(preview.code, preview.language) : null;
      return { item, preview, html };
    }),
  );

  return (
    <ul className="divide-y divide-border border-y border-border bg-card">
      {rows.map(({ item, preview, html }) => (
        <SnippetRow key={item.id} item={item} preview={preview} html={html} now={now} />
      ))}
    </ul>
  );
}

function SnippetRow({
  item,
  preview,
  html,
  now,
}: {
  item: DashboardItem;
  preview: SnippetPreview;
  html: string | null;
  now: string;
}) {
  return (
    <li className="group relative grid transition-colors hover:bg-foreground/[0.02] sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <ItemDrawerTrigger item={item} />

      {/* Literal emerald: hover variants need class names Tailwind can see, and this list is only snippets. */}
      <div className="flex min-w-0 flex-col gap-2 border-border px-5 py-4 transition-colors group-hover:border-emerald-400 sm:border-r">
        <div className="flex items-start gap-1.5">
          <h2 className="min-w-0 font-mono font-medium break-words transition-colors group-hover:text-emerald-400">{item.title}</h2>
          {item.isPinned ? (
            <Pin className="mt-1 size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
          ) : null}
          {item.isFavorite ? (
            <Star className="mt-1 size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />
          ) : null}
        </div>
        {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
        {preview.tags.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 font-mono text-xs text-foreground/70">
            {preview.tags.map((tag) => (
              <span key={tag} className="whitespace-nowrap">
                #{tag}
              </span>
            ))}
          </p>
        ) : null}
        {/* Each part keeps its separator and never breaks, so a narrow column wraps between parts. */}
        <p className="flex flex-wrap gap-x-2 font-mono text-xs text-muted-foreground">
          {preview.language ? <span className="text-emerald-400">{preview.language}</span> : null}
          <span className="whitespace-nowrap">
            {preview.language ? <span aria-hidden>/ </span> : null}
            {preview.lineCount === 1 ? "1 line" : `${preview.lineCount} lines`}
          </span>
          {item.collectionName ? (
            <span className="whitespace-nowrap">
              <span aria-hidden>/ </span>
              {item.collectionName}
            </span>
          ) : null}
          <span className="whitespace-nowrap">
            <span aria-hidden>/ </span>
            {formatRelativeTime(item.updatedAt.toISOString(), now)}
          </span>
        </p>
      </div>

      <div className="relative min-w-0 overflow-hidden bg-background px-4 py-4">
        {html ? (
          // Shiki's HTML: the code is escaped by Shiki, and is the owner's own snippet.
          <div className="snippet-code" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="font-mono text-xs text-muted-foreground">Empty snippet.</p>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent" />
        <ItemCopyButton
          itemId={item.id}
          title={item.title}
          label="Copy"
          // Opaque, since it sits on the code: the outline variant's dark background is translucent.
          // Hidden until hover only with a mouse: a touch screen, even a wide one, never hovers.
          className="absolute top-3 right-3 bg-background hover:bg-neutral-800 dark:bg-background dark:hover:bg-neutral-800 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        />
      </div>
    </li>
  );
}

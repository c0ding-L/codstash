import { ArrowUpRight, Pin, Star } from "lucide-react";

import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardItem } from "@/lib/db/items";
import { parseLinkUrl } from "@/lib/link-url";
import { cn, isWebUrl } from "@/lib/utils";

/** The link list: where each link goes first, then what it is, and a way straight there. */
export function LinkList({ items }: { items: DashboardItem[] }) {
  return (
    <ul className="divide-y divide-border border-y border-border bg-card">
      {items.map((item) => (
        <LinkRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function LinkRow({ item }: { item: DashboardItem }) {
  const url = item.url ?? "";
  const { domain, path } = parseLinkUrl(url);

  return (
    <li className="relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
      <ItemDrawerTrigger item={item} />

      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="hidden size-9 shrink-0 items-center justify-center rounded-md bg-lime-400/10 font-mono text-sm font-semibold text-lime-400 uppercase sm:flex"
            aria-hidden
          >
            {domain.charAt(0) || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-lime-400 sm:text-sm sm:text-foreground">
              {domain || "No URL"}
            </p>
            {path ? (
              <p className="hidden truncate font-mono text-xs text-muted-foreground sm:block">{path}</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-medium">{item.title}</h2>
            {item.isPinned ? (
              <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
            ) : null}
            {item.isFavorite ? (
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />
            ) : null}
          </div>
          {item.description ? (
            <p className="truncate text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
      </div>

      {/* A fixed slot, so the columns line up on rows without a button. */}
      <div className="flex w-18 shrink-0 justify-end">
        {/* Only a web address becomes a link: `url` is free text and could be `javascript:`. */}
        {isWebUrl(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.title} in a new tab`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-20")}
          >
            Open
            <ArrowUpRight data-icon="inline-end" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  );
}

"use client";

import { Copy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { copyFromPromise } from "@/lib/clipboard";
import type { ItemDetailJson } from "@/lib/db/items";
import { cn } from "@/lib/utils";

/** The item's full content, which the lists never have: content has no length cap. */
async function fetchItemContent(itemId: string) {
  const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`);
  if (!response.ok) throw new Error(`Could not load the item (${response.status}).`);
  const detail = (await response.json()) as ItemDetailJson;
  return detail.content ?? "";
}

interface ItemCopyButtonProps {
  itemId: string;
  title: string;
  /** The visible text, e.g. "Copy prompt". */
  label: string;
  className?: string;
}

/** Copies an item's content from a list, fetching it in the click so Safari still allows the write. */
export function ItemCopyButton({ itemId, title, label, className }: ItemCopyButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Copy ${title}`}
      onClick={() => copyFromPromise(fetchItemContent(itemId))}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-20", className)}
    >
      <Copy data-icon="inline-start" aria-hidden />
      {label}
    </button>
  );
}

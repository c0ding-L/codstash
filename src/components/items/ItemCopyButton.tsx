"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import type { ItemDetailJson } from "@/lib/db/items";
import { markUsed } from "@/lib/item-usage";
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
  const tc = useTranslations("common");
  const { copyFromPromise } = useClipboard();
  return (
    <button
      type="button"
      aria-label={tc("copyItem", { name: title })}
      onClick={() => void copyFromPromise(fetchItemContent(itemId)).then((copied) => copied && markUsed(itemId))}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-20", className)}
    >
      <Copy data-icon="inline-start" aria-hidden />
      {label}
    </button>
  );
}

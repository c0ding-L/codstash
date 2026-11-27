"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { markUsed } from "@/lib/item-usage";
import { cn } from "@/lib/utils";

/**
 * Copies a link's URL. The list already holds it whole, so unlike `ItemCopyButton` nothing is
 * fetched. A successful copy records a use of the item (A5).
 */
export function LinkCopyButton({ itemId, url, title, className }: { itemId: string; url: string; title: string; className?: string }) {
  const tc = useTranslations("common");
  const { copyToClipboard } = useClipboard();
  return (
    <button
      type="button"
      aria-label={tc("copyUrlOf", { name: title })}
      title={tc("copyUrl")}
      onClick={() => void copyToClipboard(url).then((copied) => copied && markUsed(itemId))}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "relative z-20", className)}
    >
      <Copy aria-hidden />
    </button>
  );
}

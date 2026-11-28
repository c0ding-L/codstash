"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTemplateCopy } from "@/components/items/FillVariablesDialog";
import { buttonVariants } from "@/components/ui/button";
import { fetchItemDetail } from "@/lib/item-client";
import { cn } from "@/lib/utils";

/** The item's full content, which the lists never have: content has no length cap. */
async function fetchItemContent(itemId: string) {
  return (await fetchItemDetail(itemId)).content ?? "";
}

interface ItemCopyButtonProps {
  itemId: string;
  title: string;
  /** The visible text, e.g. "Copy prompt". */
  label: string;
  /** The type's slug. A prompt with variables opens the variables form instead of copying at once. */
  type?: string | null;
  /** From the server: the list never has the full content to look for variables itself. */
  hasVariables?: boolean;
  className?: string;
}

/** Copies an item's content from a list, fetching it in the click so Safari still allows the write. */
export function ItemCopyButton({ itemId, title, label, type = null, hasVariables = false, className }: ItemCopyButtonProps) {
  const tc = useTranslations("common");
  const { copyItemContent, dialog } = useTemplateCopy();
  return (
    <>
      <button
        type="button"
        aria-label={tc("copyItem", { name: title })}
        onClick={() => copyItemContent(() => fetchItemContent(itemId), { itemId, type, hasVariables })}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-20", className)}
      >
        <Copy data-icon="inline-start" aria-hidden />
        {label}
      </button>
      {dialog}
    </>
  );
}

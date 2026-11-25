"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { cn } from "@/lib/utils";

/** Copies a link's URL. The list already holds it whole, so unlike `ItemCopyButton` nothing is fetched. */
export function LinkCopyButton({ url, title, className }: { url: string; title: string; className?: string }) {
  const tc = useTranslations("common");
  const { copyToClipboard } = useClipboard();
  return (
    <button
      type="button"
      aria-label={tc("copyUrlOf", { name: title })}
      title={tc("copyUrl")}
      onClick={() => copyToClipboard(url)}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "relative z-20", className)}
    >
      <Copy aria-hidden />
    </button>
  );
}

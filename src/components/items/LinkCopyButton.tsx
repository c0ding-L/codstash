"use client";

import { Copy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/** Copies a link's URL. The list already holds it whole, so unlike `ItemCopyButton` nothing is fetched. */
export function LinkCopyButton({ url, title, className }: { url: string; title: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy the URL of ${title}`}
      title="Copy URL"
      onClick={() => copyToClipboard(url)}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "relative z-20", className)}
    >
      <Copy aria-hidden />
    </button>
  );
}

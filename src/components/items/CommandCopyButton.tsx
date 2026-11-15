"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { copyToClipboard } from "@/lib/clipboard";
import type { ItemDetailJson } from "@/lib/db/items";
import { cn } from "@/lib/utils";

interface CommandCopyButtonProps {
  itemId: string;
  title: string;
  /** The command as the list has it: whole, unless `isCut`. */
  text: string;
  isCut: boolean;
  className?: string;
}

/**
 * Copies a command from the list. Uses the text the page already has, so the copy
 * happens in the click itself (Safari refuses a clipboard write after an await);
 * only a command too long to send with the page is fetched first.
 */
export function CommandCopyButton({ itemId, title, text, isCut, className }: CommandCopyButtonProps) {
  async function copy() {
    if (!isCut) return copyToClipboard(text);

    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`);
      if (!response.ok) throw new Error(String(response.status));
      const detail = (await response.json()) as ItemDetailJson;
      await copyToClipboard(detail.content ?? "");
    } catch {
      toast.error("Could not load the command to copy.");
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy ${title}`}
      onClick={copy}
      className={cn(
        "relative z-20 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <Copy className="size-3.5" aria-hidden />
    </button>
  );
}

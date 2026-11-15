"use client";

import { Copy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { copyFromPromise } from "@/lib/clipboard";
import type { ItemDetailJson } from "@/lib/db/items";
import { cn } from "@/lib/utils";

/** The prompt's full text, which the list never has: prompts have no length cap. */
async function fetchPromptText(itemId: string) {
  const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`);
  if (!response.ok) throw new Error(`Could not load the prompt (${response.status}).`);
  const detail = (await response.json()) as ItemDetailJson;
  return detail.content ?? "";
}

/** Copies a prompt from the list, fetching it in the click so Safari still allows the write. */
export function PromptCopyButton({ itemId, title, className }: { itemId: string; title: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy ${title}`}
      onClick={() => copyFromPromise(fetchPromptText(itemId))}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-20", className)}
    >
      <Copy data-icon="inline-start" aria-hidden />
      Copy prompt
    </button>
  );
}

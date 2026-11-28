"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTemplateCopy } from "@/components/items/FillVariablesDialog";
import { CopyRefusedError } from "@/lib/clipboard";
import { fetchItemDetail } from "@/lib/item-client";
import { cn } from "@/lib/utils";

interface CommandCopyButtonProps {
  itemId: string;
  title: string;
  /** The command as the list has it: whole, unless `isCut`. */
  text: string;
  isCut: boolean;
  /** From the server, for a cut command: the list does not have the rest to look for variables. */
  hasVariables: boolean;
  className?: string;
}

/**
 * Copies a command from the list. Uses the text the page already has, so the copy
 * happens in the click itself (Safari refuses a clipboard write after an await);
 * only a command too long to send with the page is fetched, through a pending
 * clipboard write. A command with variables opens the variables form first.
 */
export function CommandCopyButton({ itemId, title, text, isCut, hasVariables, className }: CommandCopyButtonProps) {
  const tc = useTranslations("common");
  const t = useTranslations("items");
  const { copyItemText, copyItemContent, dialog } = useTemplateCopy();

  // Variables open the form; a successful copy records a use of the item (A5).
  function copy() {
    if (!isCut) {
      copyItemText(text, { itemId, type: "command" });
      return;
    }

    copyItemContent(
      // A failed fetch shows this message instead of the clipboard's own.
      async () => {
        const detail = await fetchItemDetail(itemId).catch(() => {
          throw new CopyRefusedError(t("commandCopyFailed"));
        });
        return detail.content ?? "";
      },
      { itemId, type: "command", hasVariables },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={tc("copyItem", { name: title })}
        onClick={copy}
        className={cn(
          "relative z-20 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
      {dialog}
    </>
  );
}

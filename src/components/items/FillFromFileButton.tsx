"use client";

import { FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MAX_FILL_FILE_BYTES, fileToFormFill, isImportableFileName, type FileFill } from "@/lib/import";

interface FillFromFileButtonProps {
  /** Snippet, Command and custom types: the extension also picks the language. */
  withLanguage: boolean;
  disabled?: boolean;
  onFill: (fill: FileFill) => void;
}

/**
 * "Fill from a file" next to the Content label: reads one local text file in the browser and
 * hands its title, content and language to the form. Nothing is uploaded. A refused file
 * shows a toast and fills nothing.
 */
export function FillFromFileButton({ withLanguage, disabled, onFill }: FillFromFileButtonProps) {
  const t = useTranslations("newItem");
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    // The type first: a large image is refused as a file type, not as too long.
    if (!isImportableFileName(file.name)) {
      toast.error(t("fillUnsupported"));
      return;
    }
    if (file.size > MAX_FILL_FILE_BYTES) {
      toast.error(t("fillTooLong"));
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error(t("fillUnreadable"));
      return;
    }
    const fill = fileToFormFill(file.name, text, { withLanguage });
    if ("error" in fill) {
      toast.error(t(fill.error === "tooLong" ? "fillTooLong" : "fillUnsupported"));
      return;
    }
    onFill(fill);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <FileUp aria-hidden />
        {t("fillFromFile")}
      </Button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void read(event.target.files?.[0]);
          // Choosing the same file again should fire again.
          event.target.value = "";
        }}
      />
    </>
  );
}

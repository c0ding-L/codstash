"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";

/**
 * Copies a shared item's text on a public page. A copy only: the visitor is not the owner, so
 * nothing is recorded (no `markUsed`) and template variables are copied as written.
 */
export function PublicCopyButton({ text, title }: { text: string; title: string }) {
  const tc = useTranslations("common");
  const { copyToClipboard } = useClipboard();
  return (
    <Button variant="outline" size="sm" aria-label={tc("copyItem", { name: title })} onClick={() => void copyToClipboard(text)}>
      <Copy data-icon="inline-start" aria-hidden />
      {tc("copy")}
    </Button>
  );
}

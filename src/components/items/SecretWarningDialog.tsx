"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { type ItemSecretFinding, type ScannableItem, scanItem } from "@/lib/secrets";

/** Saving the form, or sending what is on screen to the AI provider. */
export type SecretCheckMode = "save" | "ai";

/**
 * Content the user has already let through, by hash: they are not asked twice about the same
 * text. In memory only, so a reload asks again.
 */
const confirmed = new Set<string>();

/**
 * FNV-1a over the mode and the scanned fields: a key for `confirmed`, never stored or sent
 * anywhere. The mode is part of it: agreeing to save a secret is not agreeing to send it to the AI.
 */
function hashFields(item: ScannableItem, mode: SecretCheckMode): string {
  const text = [mode, item.title, item.description, item.content, item.url].map((field) => field ?? "").join("\u0000");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

interface PendingCheck {
  mode: SecretCheckMode;
  findings: ItemSecretFinding[];
  key: string;
  proceed: () => void;
}

/**
 * Warns before content that looks like it holds a secret is saved or sent to the AI provider.
 * `check` runs `proceed` at once when nothing is found or the user already confirmed this
 * content; otherwise it opens the dialog, which runs it on "Save anyway" / "Send anyway".
 * Render `dialog` where the hook is used.
 */
export function useSecretCheck() {
  const [pending, setPending] = useState<PendingCheck | null>(null);

  function check(item: ScannableItem, mode: SecretCheckMode, proceed: () => void) {
    const findings = scanItem(item);
    const key = hashFields(item, mode);
    if (findings.length === 0 || confirmed.has(key)) {
      proceed();
      return;
    }
    setPending({ mode, findings, key, proceed });
  }

  function confirm() {
    if (!pending) return;
    confirmed.add(pending.key);
    setPending(null);
    pending.proceed();
  }

  const dialog = (
    <SecretWarningDialog
      pending={pending}
      onConfirm={confirm}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    />
  );

  return { check, dialog };
}

interface SecretWarningDialogProps {
  pending: PendingCheck | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Lists what looks like a secret, by kind and place, with a masked preview. */
function SecretWarningDialog({ pending, onConfirm, onOpenChange }: SecretWarningDialogProps) {
  const t = useTranslations("secrets");
  const tc = useTranslations("common");
  const mode = pending?.mode ?? "save";

  return (
    <AlertDialog open={pending !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
            <KeyRound aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("body")}
            {mode === "ai" ? ` ${t("aiProvider")}` : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm">
          {pending?.findings.map((finding, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">{t(`kinds.${finding.kind}`)}</span>{" "}
                <span className="text-muted-foreground">
                  {t("place", { field: t(`fields.${finding.field}`), line: finding.line })}
                </span>
              </span>
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{finding.preview}</code>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{mode === "save" ? t("edit") : tc("cancel")}</AlertDialogCancel>
          <Button type="button" onClick={onConfirm}>{mode === "save" ? t("saveAnyway") : t("sendAnyway")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

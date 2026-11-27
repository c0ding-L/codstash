"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useClipboard } from "@/i18n/labels";
import { markUsed } from "@/lib/item-usage";
import { loadValues, saveValues } from "@/lib/template-values";
import { fillVariables, isTemplatedType, parseVariables, variableFields } from "@/lib/template-vars";

/** The item being copied, and its type's slug: only a system prompt or command is templated. */
export interface TemplateCopyTarget {
  itemId: string;
  type: string | null;
}

/** The item whose variables the dialog asks for. `text` is null while a list fetches the content. */
interface PendingCopy {
  itemId: string;
  text: string | null;
  failed?: boolean;
}

/**
 * Copies a prompt or a command, asking for its variables first (roadmap § B). Any other item, or
 * one without variables, is copied as before. A successful copy records a use of the item (A5).
 * Render `dialog` where the hook is used.
 */
export function useTemplateCopy() {
  const { copyToClipboard, copyFromPromise } = useClipboard();
  const [pending, setPending] = useState<PendingCopy | null>(null);

  /** Copies text already on the page. A text without variables is written in the click itself. */
  function copyItemText(text: string, { itemId, type }: TemplateCopyTarget) {
    if (!isTemplatedType(type) || parseVariables(text).length === 0) {
      void copyToClipboard(text).then((copied) => copied && markUsed(itemId));
      return;
    }
    setPending({ itemId, text });
  }

  /**
   * Copies content a list fetches on click. Safari refuses a clipboard write after an `await`,
   * so the choice cannot wait for the content: `hasVariables` comes from the server with the
   * list. Without variables, the write starts in the click as before; with them, the dialog opens
   * and its own Copy click writes.
   */
  function copyItemContent(load: () => Promise<string>, { itemId, type, hasVariables }: TemplateCopyTarget & { hasVariables: boolean }) {
    if (!isTemplatedType(type) || !hasVariables) {
      void copyFromPromise(load()).then((copied) => copied && markUsed(itemId));
      return;
    }
    setPending({ itemId, text: null });
    load().then(
      (text) => setPending((current) => (current?.itemId === itemId ? { itemId, text } : current)),
      () => setPending((current) => (current?.itemId === itemId ? { itemId, text: null, failed: true } : current)),
    );
  }

  async function copy(text: string, itemId: string) {
    if (await copyToClipboard(text)) {
      markUsed(itemId);
      setPending(null);
    }
  }

  const dialog = (
    <FillVariablesDialog
      pending={pending}
      onCopy={copy}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    />
  );

  return { copyItemText, copyItemContent, dialog };
}

interface FillVariablesDialogProps {
  pending: PendingCopy | null;
  onCopy: (text: string, itemId: string) => void;
  onOpenChange: (open: boolean) => void;
}

function FillVariablesDialog({ pending, onCopy, onOpenChange }: FillVariablesDialogProps) {
  const t = useTranslations("variables");
  // The first field, or Copy when there is none. Unset while a list fetches the content: the form
  // then focuses it itself once it mounts.
  const focusRef = useRef<HTMLElement | null>(null);
  // The last copy shown, kept while the dialog fades out: `pending` is already null then, and the
  // content would otherwise switch to "Loading…" for the length of the animation.
  const [last, setLast] = useState(pending);
  if (pending !== null && pending !== last) setLast(pending);
  const shown = pending ?? last;

  return (
    <Dialog open={pending !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" initialFocus={focusRef}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {shown?.text != null ? (
          // Keyed by item. The popup unmounts once closed, so every opening starts from that
          // item's remembered values.
          <FillVariablesForm
            key={shown.itemId}
            itemId={shown.itemId}
            text={shown.text}
            onCopy={onCopy}
            focusRef={focusRef}
          />
        ) : shown?.failed ? (
          <p role="alert" className="text-muted-foreground">
            {t("loadFailed")}
          </p>
        ) : (
          <p role="status" className="text-muted-foreground">
            {t("loading")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FillVariablesFormProps {
  itemId: string;
  text: string;
  onCopy: (text: string, itemId: string) => void;
  focusRef: React.RefObject<HTMLElement | null>;
}

/** One field per variable and the filled text, live. Enter copies it; "Copy raw" copies the text as saved. */
function FillVariablesForm({ itemId, text, onCopy, focusRef }: FillVariablesFormProps) {
  const t = useTranslations("variables");
  const fields = variableFields(parseVariables(text));
  const [values, setValues] = useState(() => loadValues(itemId));
  // Fixed for the opening, so the preview shows exactly what is copied.
  const [builtins] = useState(() => {
    const id = crypto.randomUUID();
    return { now: new Date(), uuid: () => id };
  });
  const filled = fillVariables(text, values, builtins);

  // Content fetched after the dialog opened arrives after its initial focus, which then fell on
  // the close button. Focusing on mount covers that case; when the text was there from the
  // start, the dialog's `initialFocus` picks the same element.
  useEffect(() => {
    focusRef.current?.focus();
  }, [focusRef]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Only this item's fields, so a renamed variable does not keep an old value forever.
        saveValues(itemId, Object.fromEntries(fields.map(({ name }) => [name, values[name] ?? ""])));
        onCopy(filled, itemId);
      }}
    >
      {fields.length > 0 ? (
        <div className="grid max-h-60 gap-3 overflow-y-auto p-0.5">
          {fields.map(({ name, default: fallback }, index) => (
            <label key={name} className="grid gap-1.5">
              {/* The name and default are the user's own text, never translated. */}
              <span className="font-mono text-xs text-muted-foreground">{name}</span>
              <Input
                ref={index === 0 ? (element) => void (focusRef.current = element) : undefined}
                value={values[name] ?? ""}
                placeholder={fallback}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">{t("noFields")}</p>
      )}

      <div className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">{t("preview")}</span>
        <pre
          aria-label={t("preview")}
          className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
        >
          {filled}
        </pre>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onCopy(text, itemId)}>
          {t("copyRaw")}
        </Button>
        {/* With no field, Copy takes the focus, so Enter copies the filled text, not the raw one. */}
        <Button
          type="submit"
          ref={fields.length === 0 ? (element) => void (focusRef.current = element) : undefined}
        >
          {t("copy")}
        </Button>
      </DialogFooter>
    </form>
  );
}

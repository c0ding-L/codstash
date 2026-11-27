"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useState, useTransition } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { optimizePrompt } from "@/actions/ai";
import { applyOptimizedPrompt } from "@/actions/items";
import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import type { SavedItem } from "@/components/items/ItemEditForm";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { cn } from "@/lib/utils";

type Tab = "write" | "preview" | "original" | "optimized";


/** Links leave the app, so they open in a new tab. Shared with the AI explanation in `CodeEditor`. */
export const markdownComponents: Components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface MarkdownEditorProps {
  value: string;
  /** Left out for a read-only display, which shows only the preview. */
  onChange?: (value: string) => void;
  /** The id of the text area, so a `<label htmlFor>` can point at it. */
  id?: string;
  /** The accessible name of the text area and the preview. */
  ariaLabel?: string;
  invalid?: boolean;
  /** The id of the element that describes the text area, such as its error message. */
  describedBy?: string;
  className?: string;
  /**
   * Turns on the AI Optimize button. Only the drawer's read view passes it, for a saved prompt:
   * the server reads the item by its id, and `onApplied` gets the item once the user accepts.
   */
  optimize?: { itemId: string; aiAllowed: Promise<boolean>; onApplied: (saved: SavedItem) => void };
  /** Called after a successful copy. The drawer's read view records a use of the item (A5). */
  onCopied?: () => void;
}

/** Markdown with Write/Preview tabs and a copy button, in the same dark window as `CodeEditor`. */
export function MarkdownEditor({
  value,
  onChange,
  id,
  ariaLabel: ariaLabelProp,
  invalid,
  describedBy,
  className,
  optimize,
  onCopied,
}: MarkdownEditorProps) {
  const t = useTranslations("editor");
  const ta = useTranslations("ai");
  const { copyToClipboard } = useClipboard();
  const ariaLabel = ariaLabelProp ?? t("markdown");
  const readOnly = !onChange;
  const [tab, setTab] = useState<Tab>(readOnly ? "preview" : "write");
  // The AI's rewrite, offered until the user uses or discards it.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // Disable the buttons while a request runs, so a double click does not send two.
  const [optimizing, startOptimizing] = useTransition();
  const [applying, startApplying] = useTransition();
  const comparing = readOnly && suggestion !== null;
  const tabs: Tab[] = comparing ? ["original", "optimized"] : readOnly ? ["preview"] : ["write", "preview"];
  const shown: Tab = tabs.includes(tab) ? tab : tabs[0]!;

  function runOptimize() {
    if (!optimize) return;
    startOptimizing(async () => {
      const result = await optimizePrompt({ itemId: optimize.itemId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data === null) {
        toast.info(ta("alreadyClear"));
        return;
      }
      setSuggestion(result.data);
      setTab("optimized");
    });
  }

  function applySuggestion() {
    if (!optimize || suggestion === null) return;
    startApplying(async () => {
      const result = await applyOptimizedPrompt({ itemId: optimize.itemId, content: suggestion });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSuggestion(null);
      setTab("preview");
      optimize.onApplied(result.data);
      toast.success(ta("promptUpdated"));
    });
  }

  function discardSuggestion() {
    setSuggestion(null);
    setTab("preview");
  }

  return (
    <div
      className={cn(
        // shrink-0: inside a flex column (the drawer), overflow-hidden would let flex squash the
        // box below its content and clip the note instead of letting the inner pane scroll.
        "shrink-0 overflow-hidden rounded-lg border border-border bg-[#1e1e1e]",
        invalid && "border-destructive/50",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border bg-[#2d2d2d] py-1.5 pr-1.5 pl-1.5">
        <div role="tablist" aria-label={t("viewTabs", { name: ariaLabel })} className="flex gap-1">
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={shown === name}
              onClick={() => setTab(name)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                shown === name
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              {t(`tabs.${name}`)}
            </button>
          ))}
        </div>
        {optimize ? (
          <span className="ml-auto inline-flex">
            <Suspense fallback={null}>
              <AiHeaderButton
                aiAllowed={optimize.aiAllowed}
                label={ta("optimize")}
                pendingLabel={ta("optimizing")}
                hint={ta("optimizeHint")}
                pending={optimizing}
                disabled={!value.trim() || applying}
                onClick={runOptimize}
              />
            </Suspense>
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={optimize ? undefined : "ml-auto"}
          aria-label={shown === "optimized" ? t("copyOptimized") : t("copyMarkdown")}
          disabled={!value}
          // Copies what is shown: the suggestion on the Optimized tab, the saved text otherwise.
          onClick={() =>
            void copyToClipboard(shown === "optimized" && suggestion !== null ? suggestion : value).then(
              (copied) => copied && onCopied?.(),
            )
          }
        >
          <Copy aria-hidden />
        </Button>
      </div>

      {shown === "original" || shown === "optimized" ? (
        // Plain text, not Markdown: the preview drops raw tags such as `<context>`, and the user
        // must be able to check that every placeholder survived.
        <div role="tabpanel" aria-label={shown === "original" ? t("originalPrompt") : t("optimizedPrompt")}>
          <pre className="markdown-scroll max-h-[400px] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {shown === "original" ? value : suggestion}
          </pre>
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-[#2d2d2d] px-3 py-2">
            <p className="mr-auto text-xs text-muted-foreground">{t("useOptimized")}</p>
            <Button type="button" variant="ghost" size="xs" disabled={applying} onClick={discardSuggestion}>
              {t("discard")}
            </Button>
            <Button type="button" size="xs" disabled={applying} onClick={applySuggestion}>
              {applying ? t("saving") : t("useThis")}
            </Button>
          </div>
        </div>
      ) : shown === "write" ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          placeholder={t("placeholder")}
          className="markdown-scroll block field-sizing-content max-h-[400px] min-h-32 w-full resize-none bg-transparent px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <div
          role={readOnly ? undefined : "tabpanel"}
          aria-label={ariaLabel}
          className={cn("markdown-scroll max-h-[400px] overflow-y-auto px-4 py-3", !readOnly && "min-h-32")}
        >
          {value.trim() ? (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("nothingToPreview")}</p>
          )}
        </div>
      )}
    </div>
  );
}

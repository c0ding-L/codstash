"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactMarkdown, { type Components, type Options as MarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { applyOptimizedPrompt } from "@/actions/items";
import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import type { SavedItem } from "@/components/items/ItemEditForm";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { parseOptimizedPrompt } from "@/lib/ai-output";
import { remarkTemplateVars } from "@/lib/remark-template-vars";
import { parseVariables } from "@/lib/template-vars";
import { AiStreamError, streamAi } from "@/lib/ai-stream-client";
import { cn } from "@/lib/utils";

type Tab = "write" | "preview" | "original" | "optimized";

const PLUGINS = [remarkGfm];


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
  /**
   * Copies the saved text through the caller instead of straight to the clipboard. The drawer's
   * read view passes it, to fill a prompt's variables (B). The Optimized tab's rewrite is not the
   * saved prompt, so it is still copied as it is, with `onCopied`.
   */
  onCopy?: (text: string) => void;
  /** Highlights template variables in the preview: a prompt's read view. */
  highlightVariables?: boolean;
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
  onCopy,
  highlightVariables = false,
}: MarkdownEditorProps) {
  const t = useTranslations("editor");
  const ta = useTranslations("ai");
  const te = useTranslations("errors.ai");
  const { copyToClipboard } = useClipboard();
  const ariaLabel = ariaLabelProp ?? t("markdown");
  const readOnly = !onChange;
  const [tab, setTab] = useState<Tab>(readOnly ? "preview" : "write");
  // The AI's rewrite, offered until the user uses or discards it.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // The rewrite as it streams in; null when no request runs. Disables the button, so a double
  // click does not send two.
  const [streamed, setStreamed] = useState<string | null>(null);
  const optimizing = streamed !== null;
  const request = useRef<AbortController | null>(null);
  const [applying, startApplying] = useTransition();
  const comparing = readOnly && (suggestion !== null || optimizing);
  const tabs: Tab[] = comparing ? ["original", "optimized"] : readOnly ? ["preview"] : ["write", "preview"];
  const shown: Tab = tabs.includes(tab) ? tab : tabs[0]!;

  const secretCheck = useSecretCheck();

  // A prompt's read view also highlights its template variables (B), by the names the raw text has.
  const remarkPlugins = useMemo<MarkdownOptions["remarkPlugins"]>(
    () =>
      highlightVariables
        ? [remarkGfm, [remarkTemplateVars, { names: new Set(parseVariables(value).map(({ name }) => name)) }]]
        : PLUGINS,
    [highlightVariables, value],
  );

  // A drawer that closes or moves to another item stops the call.
  useEffect(() => () => request.current?.abort(), []);

  // The server sends the saved prompt, which is what this read-only view shows.
  function runOptimize() {
    if (!optimize) return;
    secretCheck.check({ content: value }, "ai", () => void requestOptimize());
  }

  // A route, not a server action: the drawer's other actions (Favorite, Pin, Save) stay usable.
  // Use / Discard appear only once the whole rewrite has come and passed the checks.
  async function requestOptimize() {
    if (!optimize || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSuggestion(null);
    setStreamed("");
    setTab("optimized");
    try {
      const { text, cutOff } = await streamAi(
        "/api/ai/optimize",
        { itemId: optimize.itemId },
        { signal: controller.signal, failedMessage: te("optimizeFailed"), onText: setStreamed },
      );
      // Half a rewrite would replace the whole prompt: never offered.
      if (cutOff) {
        toast.error(te("cutOff"));
        return;
      }
      const result = parseOptimizedPrompt(text, value);
      if (!result) toast.error(te("noOptimized"));
      else if (!result.changed) toast.info(ta("alreadyClear"));
      else setSuggestion(result.prompt);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof AiStreamError ? error.message : te("optimizeFailed"));
      }
    } finally {
      request.current = null;
      setStreamed(null);
    }
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
            {secretCheck.dialog}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={optimize ? undefined : "ml-auto"}
          aria-label={shown === "optimized" ? t("copyOptimized") : t("copyMarkdown")}
          // Nothing to copy on the Optimized tab until the rewrite has come and passed the checks.
          disabled={!value || (shown === "optimized" && suggestion === null)}
          // Copies what is shown: the suggestion on the Optimized tab, the saved text otherwise.
          onClick={() => {
            if (shown === "optimized" && suggestion !== null) {
              void copyToClipboard(suggestion).then((copied) => copied && onCopied?.());
            } else if (onCopy) {
              onCopy(value);
            } else {
              void copyToClipboard(value).then((copied) => copied && onCopied?.());
            }
          }}
        >
          <Copy aria-hidden />
        </Button>
      </div>

      {shown === "original" || shown === "optimized" ? (
        // Plain text, not Markdown: the preview drops raw tags such as `<context>`, and the user
        // must be able to check that every placeholder survived.
        <div role="tabpanel" aria-label={shown === "original" ? t("originalPrompt") : t("optimizedPrompt")}>
          <pre
            aria-busy={(shown === "optimized" && optimizing) || undefined}
            className="markdown-scroll max-h-[400px] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground"
          >
            {shown === "original" ? value : (suggestion ?? streamed)}
            {shown === "optimized" && optimizing ? (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-violet-400 align-middle" aria-hidden />
            ) : null}
          </pre>
          {suggestion !== null ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-[#2d2d2d] px-3 py-2">
              <p className="mr-auto text-xs text-muted-foreground">{t("useOptimized")}</p>
              <Button type="button" variant="ghost" size="xs" disabled={applying} onClick={discardSuggestion}>
                {t("discard")}
              </Button>
              <Button type="button" size="xs" disabled={applying} onClick={applySuggestion}>
                {applying ? t("saving") : t("useThis")}
              </Button>
            </div>
          ) : null}
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
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                components={markdownComponents}
              >
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

"use client";

import { Copy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import { markdownComponents } from "@/components/items/MarkdownEditor";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { parseStreamingExplanation } from "@/lib/ai-output";
import { AiStreamError, streamAi } from "@/lib/ai-stream-client";
import { SECRET_WARNING_HEADER } from "@/lib/ai-stream-protocol";

interface SummaryPanelProps {
  itemId: string;
  /** From the server's plan check; Free users see a crown linking to the upgrade page. */
  aiAllowed: Promise<boolean>;
  /**
   * The note's or prompt's text, checked for secrets before the call. Absent for a file: the
   * browser does not have its text, so the server checks it and the panel warns afterwards.
   */
  text?: string;
}

type Status = "streaming" | "done" | "stopped" | "cutOff";

/**
 * The drawer's Summarize action for a long note, prompt or text file (`canSummarize`): a button,
 * then the summary streamed into a panel under it, with Copy and Close. Nothing is saved. Keyed by
 * item where it is used, so a summary never carries over to another item.
 */
export function SummaryPanel({ itemId, aiAllowed, text }: SummaryPanelProps) {
  const t = useTranslations("ai");
  const te = useTranslations("errors.ai");
  const { copyToClipboard } = useClipboard();
  const secretCheck = useSecretCheck();
  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("done");
  // The running request; also keeps a double click from spending two.
  const request = useRef<AbortController | null>(null);
  const streaming = status === "streaming";

  // A drawer that closes or moves to another item stops the call.
  useEffect(() => () => request.current?.abort(), []);

  function run() {
    if (text === undefined) void requestSummary();
    else secretCheck.check({ content: text }, "ai", () => void requestSummary());
  }

  // A route, not a server action: the drawer's other actions (Favorite, Pin, Save) stay usable.
  async function requestSummary() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setSummary("");
    setStatus("streaming");
    // A stopped or failed request keeps what came; with nothing, the panel closes.
    const keepPartial = (next: Status) => {
      setSummary((current) => (current ? current : null));
      setStatus(next);
    };
    try {
      const { text: answer, cutOff } = await streamAi(
        "/api/ai/summarize",
        { itemId },
        {
          signal: controller.signal,
          failedMessage: te("summarizeFailed"),
          onHeaders: (headers) => {
            if (headers.get(SECRET_WARNING_HEADER)) toast.warning(t("fileSecretsWarning"));
          },
          onText: (partial) => setSummary(parseStreamingExplanation(partial)),
        },
      );
      const whole = parseStreamingExplanation(answer);
      if (!whole) {
        toast.error(te("noSummary"));
        setSummary(null);
        setStatus("done");
        return;
      }
      setSummary(whole);
      setStatus(cutOff ? "cutOff" : "done");
    } catch (error) {
      if (controller.signal.aborted) {
        keepPartial("stopped");
        return;
      }
      toast.error(error instanceof AiStreamError ? error.message : te("summarizeFailed"));
      keepPartial("cutOff");
    } finally {
      request.current = null;
    }
  }

  function close() {
    request.current?.abort();
    setSummary(null);
    setStatus("done");
  }

  return (
    // shrink-0: in the drawer's flex column, the panel keeps its height instead of being squashed.
    <section aria-label={t("summary")} className="shrink-0 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
        <span className="text-xs font-medium text-muted-foreground">{t("summary")}</span>
        <span className="ml-auto flex items-center gap-1">
          <Suspense fallback={null}>
            <AiHeaderButton
              aiAllowed={aiAllowed}
              label={t("summarize")}
              pendingLabel={t("summarizing")}
              hint={t("summarizeHint")}
              pending={streaming}
              disabled={false}
              onClick={run}
              onStop={() => request.current?.abort()}
              stopHint={t("stopSummaryHint")}
            />
          </Suspense>
          {summary !== null ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("copySummary")}
                disabled={streaming || !summary}
                onClick={() => void copyToClipboard(summary)}
              >
                <Copy aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("closeSummary")} onClick={close}>
                <X aria-hidden />
              </Button>
            </>
          ) : null}
        </span>
      </div>
      {secretCheck.dialog}

      {summary !== null ? (
        <div aria-busy={streaming || undefined} className="markdown-scroll max-h-[400px] overflow-y-auto border-t border-border px-4 py-3">
          {/* No rehype-raw: raw HTML in the model's answer is shown as text, never rendered. */}
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {summary}
            </ReactMarkdown>
          </div>
          {streaming ? (
            <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-400 align-middle" aria-hidden />
          ) : status === "stopped" || status === "cutOff" ? (
            <p className="mt-3 text-xs text-muted-foreground italic">
              {status === "stopped" ? t("summaryStopped") : t("summaryCutOff")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { Copy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { toast } from "sonner";

import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { StreamedMarkdown } from "@/components/items/StreamedMarkdown";
import { Button } from "@/components/ui/button";
import { useAiAnswerStream } from "@/hooks/use-ai-answer-stream";
import { useClipboard } from "@/i18n/labels";
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
  const answer = useAiAnswerStream({
    url: "/api/ai/summarize",
    failedMessage: te("summarizeFailed"),
    emptyMessage: te("noSummary"),
    onHeaders: (headers) => {
      if (headers.get(SECRET_WARNING_HEADER)) toast.warning(t("fileSecretsWarning"));
    },
  });
  const { text: summary, status, streaming } = answer;

  function run() {
    if (text === undefined) void answer.start({ itemId });
    else secretCheck.check({ content: text }, "ai", () => void answer.start({ itemId }));
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
              onStop={answer.stop}
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
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("closeSummary")} onClick={answer.reset}>
                <X aria-hidden />
              </Button>
            </>
          ) : null}
        </span>
      </div>
      {secretCheck.dialog}

      {summary !== null ? (
        <div aria-busy={streaming || undefined} className="markdown-scroll max-h-[400px] overflow-y-auto border-t border-border px-4 py-3">
          <StreamedMarkdown
            text={summary}
            status={status}
            stoppedLabel={t("summaryStopped")}
            cutOffLabel={t("summaryCutOff")}
          />
        </div>
      ) : null}
    </section>
  );
}

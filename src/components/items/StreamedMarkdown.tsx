"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { markdownComponents } from "@/components/items/MarkdownEditor";
import type { AiAnswerStatus } from "@/hooks/use-ai-answer-stream";

interface StreamedMarkdownProps {
  text: string;
  status: AiAnswerStatus;
  /** Under an answer the user stopped. */
  stoppedLabel: string;
  /** Under an answer cut short: too long, or a failure midway. */
  cutOffLabel: string;
}

/** An AI answer as it streams: Markdown, a cursor while it arrives, and a note when it did not end. */
export function StreamedMarkdown({ text, status, stoppedLabel, cutOffLabel }: StreamedMarkdownProps) {
  return (
    <>
      {/* No rehype-raw: raw HTML in the model's answer is shown as text, never rendered. */}
      <div className="markdown-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {text}
        </ReactMarkdown>
      </div>
      {status === "streaming" ? (
        <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-400 align-middle" aria-hidden />
      ) : status === "stopped" || status === "cutOff" ? (
        <p className="mt-3 text-xs text-muted-foreground italic">{status === "stopped" ? stoppedLabel : cutOffLabel}</p>
      ) : null}
    </>
  );
}

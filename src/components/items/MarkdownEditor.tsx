"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type Tab = "write" | "preview";

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
}

/** Markdown with Write/Preview tabs and a copy button, in the same dark window as `CodeEditor`. */
export function MarkdownEditor({
  value,
  onChange,
  id,
  ariaLabel = "Markdown",
  invalid,
  describedBy,
  className,
}: MarkdownEditorProps) {
  const readOnly = !onChange;
  const [tab, setTab] = useState<Tab>(readOnly ? "preview" : "write");
  const shown: Tab = readOnly ? "preview" : tab;
  const tabs: Tab[] = readOnly ? ["preview"] : ["write", "preview"];

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
        <div role="tablist" aria-label={`${ariaLabel} view`} className="flex gap-1">
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
              {name}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Copy markdown"
          disabled={!value}
          onClick={() => void copyToClipboard(value)}
        >
          <Copy aria-hidden />
        </Button>
      </div>

      {shown === "write" ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          placeholder="Write in Markdown…"
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
            <p className="text-xs text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

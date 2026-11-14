"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { toMonacoLanguage } from "@/lib/code-language";
import { cn } from "@/lib/utils";

const THEME = "codstash-dark";
const MAX_HEIGHT = 400;
/** The empty editor in edit mode, so there is room to start typing. */
const MIN_EDIT_HEIGHT = 120;
const LINE_HEIGHT = 19;
const PADDING = 12;

interface TsLanguageDefaults {
  setDiagnosticsOptions(options: { noSemanticValidation?: boolean; noSyntaxValidation?: boolean }): void;
}

/** Monaco's top-level `typescript` namespace: there at runtime, missing from its editor API types. */
type MonacoWithTypeScript = {
  typescript?: { typescriptDefaults: TsLanguageDefaults; javascriptDefaults: TsLanguageDefaults };
};

/**
 * Matches the app's dark palette: `--card` for the page, `--muted` tones for the scrollbar.
 * Also turns off type checking: a snippet stands alone, so its imports never resolve.
 */
const setUpMonaco: BeforeMount = (monaco) => {
  const ts = (monaco as unknown as MonacoWithTypeScript).typescript;
  ts?.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
  ts?.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });


  monaco.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#171717",
      "editorGutter.background": "#171717",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#525252",
      "editorLineNumber.activeForeground": "#a3a3a3",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#ffffff1a",
      "scrollbarSlider.hoverBackground": "#ffffff2e",
      "scrollbarSlider.activeBackground": "#ffffff40",
    },
  });
};

/** The height before Monaco has measured the content, so the box does not jump on load. */
function estimateHeight(value: string, minHeight: number) {
  const lines = value.split("\n").length;
  return Math.min(Math.max(lines * LINE_HEIGHT + PADDING * 2, minHeight), MAX_HEIGHT);
}

interface CodeEditorProps {
  value: string;
  /** The item's free-text language; shown in the header and used for highlighting. */
  language?: string | null;
  /** Left out for a read-only display. */
  onChange?: (value: string) => void;
  /** The accessible name of the text area. */
  ariaLabel?: string;
  className?: string;
}

/** Monaco in a macOS-style window: traffic-light dots, the language and a copy button on top. */
export function CodeEditor({ value, language, onChange, ariaLabel = "Code", className }: CodeEditorProps) {
  const readOnly = !onChange;
  const minHeight = readOnly ? 0 : MIN_EDIT_HEIGHT;
  const [height, setHeight] = useState(() => estimateHeight(value, minHeight));
  const label = language?.trim() || "plain text";

  // Grows with the content up to the cap, then Monaco scrolls inside it.
  const handleMount: OnMount = (editor) => {
    const fit = () => setHeight(Math.min(Math.max(editor.getContentHeight(), minHeight), MAX_HEIGHT));
    editor.onDidContentSizeChange(fit);
    fit();
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 py-1.5 pr-1.5 pl-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy code"
          disabled={!value}
          onClick={() => void copyToClipboard(value)}
        >
          <Copy aria-hidden />
        </Button>
      </div>

      <Editor
        height={height}
        theme={THEME}
        language={toMonacoLanguage(language)}
        value={value}
        onChange={(next) => onChange?.(next ?? "")}
        beforeMount={setUpMonaco}
        onMount={handleMount}
        loading={<div className="h-full w-full bg-card" />}
        options={{
          readOnly,
          domReadOnly: readOnly,
          ariaLabel,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: 13,
          lineHeight: LINE_HEIGHT,
          padding: { top: PADDING, bottom: PADDING },
          lineNumbersMinChars: 3,
          folding: false,
          renderLineHighlight: readOnly ? "none" : "line",
          contextmenu: !readOnly,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          tabSize: 2,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
            // Below the cap there is nothing to scroll, so the wheel scrolls the page instead.
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
    </div>
  );
}

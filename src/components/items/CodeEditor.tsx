"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { explainCode } from "@/actions/ai";
import { useEditorPreferences } from "@/components/editor/EditorPreferencesContext";
import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { markdownComponents } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { languageLabel, toMonacoLanguage } from "@/lib/code-language";
import { DEFAULT_EDITOR_PREFERENCES } from "@/lib/editor-preferences";
import { CUSTOM_MONACO_THEMES } from "@/lib/monaco-themes";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 400;
/** The empty editor in edit mode, so there is room to start typing. */
const MIN_EDIT_HEIGHT = 120;
const PADDING = 12;

/** 19px at the default 13px, the height Monaco's own default line works out to. */
function lineHeightFor(fontSize: number) {
  return Math.round(fontSize * 1.45);
}

interface TsLanguageDefaults {
  setDiagnosticsOptions(options: { noSemanticValidation?: boolean; noSyntaxValidation?: boolean }): void;
}

/** Monaco's top-level `typescript` namespace: there at runtime, missing from its editor API types. */
type MonacoWithTypeScript = {
  typescript?: { typescriptDefaults: TsLanguageDefaults; javascriptDefaults: TsLanguageDefaults };
};

/**
 * Defines the themes Monaco does not ship (`vs-dark` is built in).
 * Also turns off type checking: a snippet stands alone, so its imports never resolve.
 */
const setUpMonaco: BeforeMount = (monaco) => {
  const ts = (monaco as unknown as MonacoWithTypeScript).typescript;
  ts?.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
  ts?.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });

  for (const [name, theme] of Object.entries(CUSTOM_MONACO_THEMES)) monaco.editor.defineTheme(name, theme);
};

/** The height before Monaco has measured the content, so the box does not jump on load. */
function estimateHeight(value: string, minHeight: number, lineHeight: number) {
  const lines = value.split("\n").length;
  return Math.min(Math.max(lines * lineHeight + PADDING * 2, minHeight), MAX_HEIGHT);
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
  /**
   * Turns on the AI Explain button. Only the drawer's read view passes it, for a
   * saved snippet or command: the server reads the item by its id.
   */
  explain?: { itemId: string; aiAllowed: Promise<boolean> };
  /** Called after a successful copy. The drawer's read view records a use of the item (A5). */
  onCopied?: () => void;
}

type View = "code" | "explain";

/** Monaco in a macOS-style window: traffic-light dots, the language and a copy button on top. */
export function CodeEditor({ value, language, onChange, ariaLabel: ariaLabelProp, className, explain, onCopied }: CodeEditorProps) {
  const t = useTranslations("editor");
  const ta = useTranslations("ai");
  const { copyToClipboard } = useClipboard();
  const ariaLabel = ariaLabelProp ?? t("code");
  const readOnly = !onChange;
  const minHeight = readOnly ? 0 : MIN_EDIT_HEIGHT;
  const tf = useTranslations("itemForm");
  // No language is "Plain text", the one label that is not a language name.
  const label = language?.trim() ? languageLabel(language.trim()) : tf("plainText");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [view, setView] = useState<View>("code");
  // Disables the button while a request runs, so a double click does not spend two.
  const [pending, startTransition] = useTransition();
  const shown: View = explanation === null ? "code" : view;
  const secretCheck = useSecretCheck();

  // The server sends the saved code, which is what this read-only view shows.
  function runExplain() {
    if (!explain) return;
    secretCheck.check({ content: value }, "ai", requestExplain);
  }

  function requestExplain() {
    if (!explain) return;
    startTransition(async () => {
      const result = await explainCode({ itemId: explain.itemId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setExplanation(result.data);
      setView("explain");
    });
  }

  return (
    // shrink-0: in the drawer's flex column, overflow-hidden would let flex squash the box and clip it.
    <div className={cn("shrink-0 overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 py-1.5 pr-1.5 pl-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        {explanation !== null ? (
          <div role="tablist" aria-label={t("viewTabs", { name: ariaLabel })} className="flex gap-1">
            {(["code", "explain"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={shown === name}
                onClick={() => setView(name)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  shown === name
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                {t(`tabs.${name}`)}
              </button>
            ))}
          </div>
        ) : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">{label}</span>
        {explain ? (
          <Suspense fallback={null}>
            <AiHeaderButton
              aiAllowed={explain.aiAllowed}
              label={ta("explain")}
              pendingLabel={ta("explaining")}
              hint={ta("explainHint")}
              pending={pending}
              disabled={!value.trim()}
              onClick={runExplain}
            />
          </Suspense>
        ) : null}
        {secretCheck.dialog}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("copyCode")}
          disabled={!value}
          onClick={() => void copyToClipboard(value).then((copied) => copied && onCopied?.())}
        >
          <Copy aria-hidden />
        </Button>
      </div>

      {/* Hidden rather than unmounted on the Explain tab, so Monaco does not start over on Code. */}
      <div hidden={shown !== "code"}>
        {/* The preferences stream in from the layout; until then, a box of the default height. */}
        <Suspense fallback={<EditorPlaceholder value={value} minHeight={minHeight} />}>
          <MonacoPane
            value={value}
            language={language}
            onChange={onChange}
            ariaLabel={ariaLabel}
            readOnly={readOnly}
            minHeight={minHeight}
          />
        </Suspense>
      </div>

      {shown === "explain" && explanation !== null ? (
        <div
          role="tabpanel"
          aria-label={t("explanation")}
          className="markdown-scroll max-h-[400px] overflow-y-auto px-4 py-3"
        >
          {/* No rehype-raw: raw HTML in the model's answer is shown as text, never rendered. */}
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {explanation}
            </ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function EditorPlaceholder({ value, minHeight }: { value: string; minHeight: number }) {
  const height = estimateHeight(value, minHeight, lineHeightFor(DEFAULT_EDITOR_PREFERENCES.fontSize));
  return <div className="w-full bg-card" style={{ height }} />;
}

interface MonacoPaneProps {
  value: string;
  language?: string | null;
  onChange?: (value: string) => void;
  ariaLabel: string;
  readOnly: boolean;
  minHeight: number;
}

/** Monaco itself, set up from the user's editor preferences. */
function MonacoPane({ value, language, onChange, ariaLabel, readOnly, minHeight }: MonacoPaneProps) {
  const preferences = useEditorPreferences();
  const lineHeight = lineHeightFor(preferences.fontSize);
  const [height, setHeight] = useState(() => estimateHeight(value, minHeight, lineHeight));

  // Grows with the content up to the cap, then Monaco scrolls inside it.
  const handleMount: OnMount = (editor) => {
    const fit = () => setHeight(Math.min(Math.max(editor.getContentHeight(), minHeight), MAX_HEIGHT));
    editor.onDidContentSizeChange(fit);
    fit();
  };

  return (
    <Editor
      height={height}
      theme={preferences.theme}
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
        minimap: { enabled: preferences.minimap },
        scrollBeyondLastLine: false,
        wordWrap: preferences.wordWrap ? "on" : "off",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: preferences.fontSize,
        lineHeight,
        padding: { top: PADDING, bottom: PADDING },
        lineNumbersMinChars: 3,
        folding: false,
        renderLineHighlight: readOnly ? "none" : "line",
        contextmenu: !readOnly,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        tabSize: preferences.tabSize,
        // Otherwise Monaco guesses the tab size from the content and ignores the setting.
        detectIndentation: false,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
          // Below the cap there is nothing to scroll, so the wheel scrolls the page instead.
          alwaysConsumeMouseWheel: false,
        },
      }}
    />
  );
}

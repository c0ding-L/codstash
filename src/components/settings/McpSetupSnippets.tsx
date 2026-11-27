"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useClipboard } from "@/i18n/labels";
import { claudeCodeCommand, cursorConfig, MCP_TOKEN_PLACEHOLDER } from "@/lib/mcp-setup";

interface McpSetupSnippetsProps {
  /** The app's public origin, from the server. */
  origin: string;
  /** Filled in only in the one-time view after creating a token; the placeholder otherwise. */
  token?: string;
}

/** "Connect an AI assistant": the Claude Code command and Cursor's `mcp.json`, ready to copy. */
export function McpSetupSnippets({ origin, token }: McpSetupSnippetsProps) {
  const t = useTranslations("settings.mcp");
  const snippets = [
    { id: "claude", label: t("claudeCode"), hint: t("claudeCodeHint"), text: claudeCodeCommand(origin, token) },
    { id: "cursor", label: t("cursor"), hint: t("cursorHint"), text: cursorConfig(origin, token) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {snippets.map((snippet) => (
        <Snippet key={snippet.id} {...snippet} />
      ))}
      <p className="text-xs text-muted-foreground">
        {token ? t("tokenFilled") : t("tokenPlaceholder", { placeholder: MCP_TOKEN_PLACEHOLDER })}
      </p>
    </div>
  );
}

function Snippet({ label, hint, text }: { label: string; hint: string; text: string }) {
  const t = useTranslations("settings.mcp");
  const { copyToClipboard } = useClipboard();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("copy", { name: label })}
          title={t("copy", { name: label })}
          onClick={() => void copyToClipboard(text)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs break-all whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

"use client";

import { FileJson, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ImportConflictChoice } from "@/components/settings/ImportConflictChoice";
import { Button } from "@/components/ui/button";
import { ImportFormatError, fromCortexExport, type ImportConflict, type ParsedImport } from "@/lib/import";

interface ImportCortexTabProps {
  busy: boolean;
  onImport: (parsed: ParsedImport, conflict: ImportConflict) => Promise<void>;
}

/** A Cortex JSON export (A1), read and mapped in the browser, then sent in batches. */
export function ImportCortexTab({ busy, onImport }: ImportCortexTabProps) {
  const t = useTranslations("settings.import");
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [conflict, setConflict] = useState<ImportConflict>("skip");

  async function choose(file: File | undefined) {
    setParsed(null);
    setFileName(null);
    if (!file) return;
    try {
      const next = fromCortexExport(JSON.parse(await file.text()));
      setParsed(next);
      setFileName(file.name);
    } catch (error) {
      toast.error(error instanceof ImportFormatError || error instanceof SyntaxError ? t("notExport") : t("unreadable"));
    }
  }

  async function submit() {
    if (!parsed) return;
    await onImport(parsed, conflict);
    setParsed(null);
    setFileName(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("cortexHint")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <FileJson className="size-4" aria-hidden />
          {t("cortexPick")}
          <input
            id={inputId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {fileName ? <span className="truncate text-sm text-muted-foreground">{fileName}</span> : null}
      </div>

      {parsed ? (
        <>
          <p className="text-sm">
            {t("found", { count: parsed.candidates.length })}
            {parsed.result.skipped.file > 0 ? ` · ${t("report.file", { count: parsed.result.skipped.file })}` : null}
          </p>
          <ImportConflictChoice value={conflict} onChange={setConflict} disabled={busy} />
          <div>
            <Button type="button" className="gap-2" disabled={busy || parsed.candidates.length === 0} onClick={() => void submit()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("import")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  mergeImportResults,
  toImportBatches,
  type ImportConflict,
  type ImportResult,
  type ParsedImport,
} from "@/lib/import";
import { responseError } from "@/lib/response-error";

export interface ImportProgress {
  done: number;
  total: number;
}

/** A route's import report, plus what only the gists route adds. */
export type ImportReportData = ImportResult & { gistsNotFetched?: number; gistFilesSkipped?: number };

/**
 * Sends a parsed import in batches to `POST /api/import` and sums the reports, with the
 * progress for "Imported 300 / 1,200". A refused batch stops the run and keeps what was
 * imported; so does the Free limit, since every later batch would hit it too.
 */
export function useImportRunner() {
  const t = useTranslations("settings.import");
  const router = useRouter();
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<ImportReportData | null>(null);

  /** `failed`: a refused or lost request already showed its error, so no success toast. */
  function finish(result: ImportReportData, failed = false) {
    setReport(result);
    setProgress(null);
    if (!failed) toast.success(t("done", { count: result.created }));
    if (result.created > 0) router.refresh();
  }

  async function run(parsed: ParsedImport, conflict: ImportConflict) {
    const batches = toImportBatches(parsed, conflict);
    const total = parsed.candidates.length;
    let result = parsed.result;
    let done = 0;
    let failed = false;
    setReport(null);
    setProgress({ done, total });

    for (const batch of batches) {
      let response: Response;
      try {
        response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
      } catch {
        toast.error(t("failed"));
        failed = true;
        break;
      }
      if (!response.ok) {
        toast.error((await responseError(response)) ?? t("failed"));
        failed = true;
        break;
      }
      result = mergeImportResults(result, (await response.json()) as ImportResult);
      done += batch.candidates.length;
      setProgress({ done, total });
      if (result.skipped.limit > 0) {
        result.skipped.limit += total - done;
        break;
      }
    }
    finish(result, failed);
  }

  /** A run that is one request of its own (gists), reported the same way. */
  async function runOne(request: () => Promise<Response>, total: number) {
    setReport(null);
    setProgress({ done: 0, total });
    try {
      const response = await request();
      if (!response.ok) {
        toast.error((await responseError(response)) ?? t("failed"));
        setProgress(null);
        return;
      }
      const result = (await response.json()) as ImportReportData & { warning?: string };
      if (result.warning) toast.warning(result.warning);
      finish(result);
    } catch {
      toast.error(t("failed"));
      setProgress(null);
    }
  }

  return { run, runOne, progress, report, busy: progress !== null };
}

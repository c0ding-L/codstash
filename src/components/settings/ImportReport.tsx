"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { ImportProgress, ImportReportData } from "@/components/settings/use-import-runner";

/** The progress of a running import, then the counts of the last one: every non-zero line. */
export function ImportReport({ progress, report }: { progress: ImportProgress | null; report: ImportReportData | null }) {
  const t = useTranslations("settings.import");

  if (progress) {
    const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
    return (
      <div className="flex items-center gap-3" aria-live="polite">
        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("importing", { done: progress.done, total: progress.total })}
        </span>
      </div>
    );
  }
  if (!report) return null;

  const lines = [
    ["created", report.created],
    ["collectionsCreated", report.collectionsCreated],
    ["duplicate", report.skipped.duplicate],
    ["file", report.skipped.file],
    ["tooLong", report.skipped.tooLong],
    ["invalid", report.skipped.invalid],
    ["limit", report.skipped.limit],
    ["collectionLinksDropped", report.collectionLinksDropped],
    ["gistsNotFetched", report.gistsNotFetched ?? 0],
  ] as const;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm" aria-live="polite">
      <ul className="flex flex-col gap-1">
        {lines
          .filter(([, count]) => count > 0)
          .map(([key, count]) => (
            <li key={key} className={key === "created" ? "font-medium" : "text-muted-foreground"}>
              {t(`report.${key}`, { count })}
            </li>
          ))}
        {report.created === 0 && lines.every(([, count]) => count === 0) ? (
          <li className="text-muted-foreground">{t("report.nothing")}</li>
        ) : null}
      </ul>
      {report.invalidTitles.length > 0 ? (
        <p className="text-xs break-words text-muted-foreground">
          {t("report.invalidTitles", { titles: report.invalidTitles.join(", ") })}
        </p>
      ) : null}
      {report.created > 0 ? (
        <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("dashboard")}
        </Link>
      ) : null}
    </div>
  );
}

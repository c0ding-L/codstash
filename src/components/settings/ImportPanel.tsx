"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ImportCortexTab } from "@/components/settings/ImportCortexTab";
import { ImportFilesTab } from "@/components/settings/ImportFilesTab";
import { ImportGistsTab } from "@/components/settings/ImportGistsTab";
import { ImportReport } from "@/components/settings/ImportReport";
import { useImportRunner } from "@/components/settings/use-import-runner";
import { cn } from "@/lib/utils";

const TABS = ["cortex", "files", "gists"] as const;
type Tab = (typeof TABS)[number];

/** The three import sources as tabs, sharing one runner, progress bar and report. */
export function ImportPanel() {
  const t = useTranslations("settings.import");
  const [tab, setTab] = useState<Tab>("cortex");
  const { run, runOne, progress, report, busy } = useImportRunner();

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("tabsLabel")} className="flex flex-wrap gap-1">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`import-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`import-panel-${name}`}
            disabled={busy}
            onClick={() => setTab(name)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              tab === name
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {t(`tabs.${name}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`import-panel-${tab}`} aria-labelledby={`import-tab-${tab}`}>
        {tab === "cortex" ? <ImportCortexTab busy={busy} onImport={run} /> : null}
        {tab === "files" ? <ImportFilesTab busy={busy} onImport={run} /> : null}
        {tab === "gists" ? <ImportGistsTab busy={busy} onImport={runOne} /> : null}
      </div>

      <ImportReport progress={progress} report={report} />
    </div>
  );
}

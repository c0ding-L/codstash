"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dropZoneClassName, useFileDrop } from "@/hooks/use-file-drop";
import { languageLabel } from "@/lib/code-language";
import {
  countRefused,
  detectFileType,
  emptyImportResult,
  fromLooseFile,
  type ImportCandidate,
  type ImportConflict,
  type ParsedImport,
} from "@/lib/import";
import { ITEM_LIMITS } from "@/lib/item-limits";

type FileType = "note" | "snippet" | "command";
const FILE_TYPES: readonly FileType[] = ["note", "snippet", "command"];

/** UTF-8 is at most 4 bytes a character: a larger file is over the content cap without reading it. */
const MAX_FILE_BYTES = ITEM_LIMITS.content * 4;

interface Entry {
  key: string;
  file: File;
  type: FileType;
  language: string | null;
}

interface ImportFilesTabProps {
  busy: boolean;
  onImport: (parsed: ParsedImport, conflict: ImportConflict) => Promise<void>;
}

/** Loose `.md`, `.txt` and code files, each previewed with its detected type, which can be changed. */
export function ImportFilesTab({ busy, onImport }: ImportFilesTabProps) {
  const t = useTranslations("settings.import");
  const tt = useTranslations("itemTypes");
  const inputId = useId();
  const [entries, setEntries] = useState<Entry[]>([]);

  function add(files: FileList | null) {
    if (!files) return;
    let unsupported = 0;
    const added: Entry[] = [];
    for (const file of Array.from(files)) {
      const detected = detectFileType(file.name);
      if (!detected) {
        unsupported += 1;
        continue;
      }
      added.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, ...detected });
    }
    if (unsupported > 0) toast.error(t("filesUnsupported", { count: unsupported }));
    setEntries((current) => [...current, ...added.filter((entry) => !current.some((c) => c.key === entry.key))]);
  }

  const { dragging, dropProps } = useFileDrop({ disabled: busy, onFiles: add });

  async function submit() {
    const result = emptyImportResult();
    const candidates: ImportCandidate[] = [];
    for (const entry of entries) {
      if (entry.file.size > MAX_FILE_BYTES) {
        result.skipped.tooLong += 1;
        continue;
      }
      const checked = fromLooseFile(entry.file.name, await entry.file.text(), entry.type);
      if (!checked) continue;
      if (checked.ok) candidates.push(checked.candidate);
      else countRefused(result, checked);
    }
    await onImport({ candidates, types: [], collections: [], result }, "skip");
    setEntries([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={inputId} {...dropProps} className={dropZoneClassName({ dragging, disabled: busy })}>
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <span className="text-sm">
          {t.rich("filesDrop", { strong: (chunks) => <span className="font-medium">{chunks}</span> })}
        </span>
        <span className="text-xs text-muted-foreground">{t("filesHint")}</span>
        <input
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {entries.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {entries.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.file.name}</p>
                  {entry.type !== "note" && entry.language ? (
                    <p className="text-xs text-muted-foreground">{languageLabel(entry.language)}</p>
                  ) : null}
                </div>
                <Select
                  items={FILE_TYPES.map((value) => ({ value, label: tt(`${value}.one`) }))}
                  value={entry.type}
                  disabled={busy}
                  onValueChange={(next: FileType | null) =>
                    next !== null &&
                    setEntries((current) => current.map((c) => (c.key === entry.key ? { ...c, type: next } : c)))
                  }
                >
                  <SelectTrigger aria-label={t("typeFor", { name: entry.file.name })} className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tt(`${value}.one`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove", { name: entry.file.name })}
                  disabled={busy}
                  onClick={() => setEntries((current) => current.filter((c) => c.key !== entry.key))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button type="button" className="gap-2" disabled={busy} onClick={() => void submit()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("importFiles", { count: entries.length })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

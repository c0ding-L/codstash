"use client";

import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { acceptAttribute, allowedExtensions, UPLOAD_RULES, type UploadKind, validateUpload } from "@/lib/files";
import { useFileSize } from "@/i18n/labels";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  kind: UploadKind;
  file: File | null;
  /** Called with a file that passed the checks, or null when it is removed. */
  onFileChange: (file: File | null) => void;
  /** Called with the reason a dropped or chosen file was refused. */
  onReject: (message: string) => void;
  /** 0 to 1 while uploading, null otherwise. */
  progress: number | null;
  /** The id of the file input, so a `<label htmlFor>` can point at it. */
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

/** A drop zone that turns into a preview of the chosen file, with the upload's progress under it. */
export function FileUpload({
  kind,
  file,
  onFileChange,
  onReject,
  progress,
  id,
  invalid,
  describedBy,
  disabled,
}: FileUploadProps) {
  const t = useTranslations("upload");
  const te = useTranslations("errors.upload");
  const formatFileSize = useFileSize();
  const [dragging, setDragging] = useState(false);
  const rules = UPLOAD_RULES[kind];

  function take(candidate: File | undefined) {
    if (!candidate) return;
    const check = validateUpload(kind, candidate);
    if (check.ok) onFileChange(candidate);
    else onReject(te(check.error.key, check.error.values));
  }

  // Mounted in both states, so the field's label and error message always point at it.
  const input = (
    <input
      id={id}
      type="file"
      accept={acceptAttribute(kind)}
      className="sr-only"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
      onChange={(event) => {
        take(event.target.files?.[0]);
        // Choosing the same file again after removing it should fire again.
        event.target.value = "";
      }}
    />
  );

  if (file) {
    const percent = progress === null ? null : Math.round(progress * 100);
    return (
      <div className={cn("flex flex-col gap-3 rounded-lg border border-border p-3", invalid && "border-destructive/50")}>
        {kind === "image" ? (
          <ImagePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
        ) : null}
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {kind === "image" ? <ImageIcon aria-hidden /> : <FileText aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("remove")}
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X aria-hidden />
          </Button>
        </div>

        {percent !== null ? (
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
          </div>
        ) : null}
        {input}
      </div>
    );
  }

  return (
    <label
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        // Leaving for one of the zone's own children is not leaving the zone.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) take(event.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors",
        "hover:border-ring hover:bg-muted/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        dragging && "border-ring bg-muted/60",
        invalid && "border-destructive/50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload className="size-5 text-muted-foreground" aria-hidden />
      <span className="text-sm">
        {t.rich(kind === "image" ? "dropImage" : "dropFile", {
          strong: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("limits", { extensions: allowedExtensions(kind).join(", "), size: rules.maxBytes / (1024 * 1024) })}
      </span>
      {input}
    </label>
  );
}

/** A local preview, read as a data URL so nothing has to be revoked. */
function ImagePreview({ file }: { file: File }) {
  const t = useTranslations("upload");
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setSrc(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return (
    <div className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-muted/50">
      {src ? (
        // A data URL of the user's own file: next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={t("preview", { name: file.name })} className="max-h-full max-w-full object-contain" />
      ) : null}
    </div>
  );
}

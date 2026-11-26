"use client";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportFileName, filenameFromDisposition, type ExportFormat } from "@/lib/export";
import { responseError } from "@/lib/response-error";

/**
 * The two export downloads. Fetched rather than a plain `<a download>` link, so a refusal
 * (429 past the limit, 403 after Pro ran out) shows the route's message in a toast instead
 * of a silent "Failed" download. The browser keeps the file as a Blob, which it can spill
 * to disk for a large ZIP.
 */
export function ExportButtons() {
  const t = useTranslations("settings.data");
  const [pending, setPending] = useState<ExportFormat | null>(null);

  async function download(format: ExportFormat) {
    setPending(format);
    try {
      const response = await fetch(`/api/export?format=${format}`);
      if (!response.ok) {
        toast.error((await responseError(response)) ?? t("failed"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileName = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        exportFileName(format, new Date()),
      );
      link.download = fileName;
      link.click();
      toast.success(t("done", { file: fileName }));
      // After the click has handed the URL to the download.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error(t("failed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["json", "zip"] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending !== null}
          onClick={() => void download(format)}
        >
          {pending === format ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          {pending === format ? t("preparing") : t(format)}
        </Button>
      ))}
    </div>
  );
}

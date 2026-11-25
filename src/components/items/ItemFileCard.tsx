import { Download, FileText, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { extensionOf } from "@/lib/files";
import { useFileSize } from "@/i18n/labels";
import { cn } from "@/lib/utils";

/** The uploaded file: its icon, name and extension, with the download button, in a light frame. */
export function ItemFileCard({ href, fileName, fileSize, isImage }: { href: string; fileName: string; fileSize: number | null; isImage: boolean }) {
  const tc = useTranslations("common");
  const formatFileSize = useFileSize();
  const Icon = isImage ? ImageIcon : FileText;
  const extension = extensionOf(fileName);

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background/60 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {[extension ? extension.toUpperCase() : null, fileSize ? formatFileSize(fileSize) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <a href={href} download={fileName} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
        <Download aria-hidden />
        {tc("download")}
      </a>
    </div>
  );
}

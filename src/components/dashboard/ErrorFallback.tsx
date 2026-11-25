"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Shared body for the error boundaries. It never renders `error.message`:
 * Prisma and connection errors can carry internals. The digest is what lets a
 * failure be matched to the server log.
 */
export function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error & { digest?: string };
  onRetry: () => void;
}) {
  const t = useTranslations("errorFallback");
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-border p-8 text-center"
    >
      <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">{t("reference", { digest: error.digest })}</p>
        ) : null}
      </div>
      <Button onClick={onRetry}>{t("retry")}</Button>
    </div>
  );
}

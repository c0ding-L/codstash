"use client";

import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revokeApiToken } from "@/actions/api-tokens";
import { ApiTokenDialog } from "@/components/settings/ApiTokenDialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiTokenSummary } from "@/lib/db/api-tokens";
import { cn } from "@/lib/utils";

interface ApiTokensManagerProps {
  tokens: ApiTokenSummary[];
  /** False on Free and once Pro has lapsed: only `read` tokens can be created. */
  canWrite: boolean;
  /** At the cap, "New token" is disabled. */
  max: number;
}

/** Settings › API tokens: the active tokens, with New and Revoke. */
export function ApiTokensManager({ tokens, canWrite, max }: ApiTokensManagerProps) {
  const t = useTranslations("settings.api");
  const format = useFormatter();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiTokenSummary | null>(null);
  // Expired tokens are listed but do not count: only active ones fill the cap.
  const atCap = tokens.filter((token) => !token.expired).length >= max;
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-4">
      {tokens.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-start gap-3 p-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className={cn("flex min-w-0 flex-1 flex-col gap-1", token.expired && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate font-medium">{token.name}</span>
                  <Badge variant="secondary">{t(`scopes.${token.scope}`)}</Badge>
                  {token.expired ? <Badge variant="outline">{t("expiredBadge")}</Badge> : null}
                </div>
                <code className="font-mono text-xs text-muted-foreground">{token.prefix}…</code>
                <p className="text-xs text-muted-foreground">
                  {[
                    t("created", { date: date(token.createdAt) }),
                    token.lastUsedAt ? t("lastUsed", { date: date(token.lastUsedAt) }) : t("neverUsed"),
                    token.expiresAt
                      ? t(token.expired ? "expired" : "expires", { date: date(token.expiresAt) })
                      : t("noExpiry"),
                  ].join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t("revokeLabel", { name: token.name })}
                onClick={() => setRevoking(token)}
              >
                {t("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={atCap} onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
        {atCap ? <p className="text-sm text-muted-foreground">{t("atCap", { max })}</p> : null}
      </div>

      {creating ? <ApiTokenDialog canWrite={canWrite} onClose={() => setCreating(false)} /> : null}
      {revoking ? <RevokeApiTokenDialog token={revoking} onOpenChange={(open) => !open && setRevoking(null)} /> : null}
    </div>
  );
}

/** Asks before revoking: anything using the token loses access at once. */
function RevokeApiTokenDialog({
  token,
  onOpenChange,
}: {
  token: ApiTokenSummary;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.api");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startRevoking] = useTransition();

  function handleRevoke() {
    startRevoking(async () => {
      const result = await revokeApiToken(token.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("revoked"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    // Escape and Cancel do nothing while the revoke runs: its outcome must still show.
    <AlertDialog open onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <TriangleAlert aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich("revokeBody", {
              token: token.name,
              name: (chunks) => <span className="font-medium break-words text-foreground">{chunks}</span>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={pending}
            onClick={handleRevoke}
          >
            {pending ? t("revoking") : t("revoke")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

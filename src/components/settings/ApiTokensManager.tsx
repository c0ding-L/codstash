"use client";

import { KeyRound, Plus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { revokeApiToken } from "@/actions/api-tokens";
import { ApiTokenDialog } from "@/components/settings/ApiTokenDialog";
import { DestructiveConfirmDialog, emphasizeName } from "@/components/DestructiveConfirmDialog";
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
  /** The app's public origin, for the MCP snippets of the one-time view. */
  origin: string;
}

/** Settings › API tokens: the active tokens, with New and Revoke. */
export function ApiTokensManager({ tokens, canWrite, max, origin }: ApiTokensManagerProps) {
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

      {creating ? <ApiTokenDialog canWrite={canWrite} origin={origin} onClose={() => setCreating(false)} /> : null}
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
  const router = useRouter();

  return (
    <DestructiveConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={t("revokeTitle")}
      body={t.rich("revokeBody", { token: token.name, name: emphasizeName })}
      confirmLabel={t("revoke")}
      pendingLabel={t("revoking")}
      action={() => revokeApiToken(token.id)}
      successMessage={t("revoked")}
      onSuccess={() => router.refresh()}
    />
  );
}

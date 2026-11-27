"use client";

import { Copy, ExternalLink, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { getSharing, setSharing, type SetSharingInput, type ShareStatus } from "@/actions/share";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useClipboard } from "@/i18n/labels";
import type { ShareKind } from "@/lib/share";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
  kind: ShareKind;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

/**
 * The public link of a collection or an item (D1): on / off, copy, reset, and the two toggles.
 * The settings live in the popup, which mounts on each opening, so it never shows a stale link.
 */
export function ShareDialog({ kind, id, open, onOpenChange }: ShareDialogProps) {
  const t = useTranslations("share");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "item" ? t("titleItem") : t("titleCollection")}</DialogTitle>
          <DialogDescription>{kind === "item" ? t("descriptionItem") : t("descriptionCollection")}</DialogDescription>
        </DialogHeader>
        <ShareSettingsPanel kind={kind} id={id} />
      </DialogContent>
    </Dialog>
  );
}

function ShareSettingsPanel({ kind, id }: { kind: ShareKind; id: string }) {
  const t = useTranslations("share");
  const router = useRouter();
  const { copyToClipboard } = useClipboard();
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Mounted in the browser only: the popup is closed when the page renders on the server.
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const ids = { switch: useId(), link: useId(), indexable: useId(), owner: useId() };

  useEffect(() => {
    let cancelled = false;
    void getSharing({ kind, id }).then((result) => {
      if (cancelled) return;
      if (result.success) setStatus(result.data);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  function save(change: Omit<SetSharingInput, "kind" | "id" | "shared"> & { shared?: boolean }, done?: string) {
    if (!status) return;
    setError(null);
    startSaving(async () => {
      const result = await setSharing({ kind, id, shared: change.shared ?? status.shareId !== null, ...change });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus(result.data);
      if (done) toast.success(done);
      router.refresh();
    });
  }

  const url = status?.path ? `${origin}${status.path}` : null;
  const shared = status?.shareId != null;
  const busy = saving || !status;
  const atCap = !shared && status?.usage.max != null && status.usage.used >= status.usage.max;

  return loadError ? (
    <p role="alert" className="text-sm text-destructive">
      {loadError}
    </p>
  ) : !status ? (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {t("loading")}
    </p>
  ) : (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleRow
        id={ids.switch}
        label={t("switch")}
        checked={shared}
        disabled={busy}
        onChange={(next) => save({ shared: next }, next ? t("on") : t("off"))}
      />

      {url ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.link} className="text-sm font-medium">
            {t("linkLabel")}
          </label>
          <div className="flex min-w-0 items-center gap-1">
            <Input
              id={ids.link}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={t("copyLink")}
              onClick={() => void copyToClipboard(url)}
            >
              <Copy aria-hidden />
            </Button>
            <Link
              href={status.path!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("openLink")}
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ExternalLink aria-hidden />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              disabled={busy}
              onClick={() => save({ resetLink: true }, t("resetDone"))}
            >
              <RefreshCw aria-hidden />
              {t("reset")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("resetHint")}</span>
          </div>
        </div>
      ) : null}

      <ToggleRow
        id={ids.indexable}
        label={t("indexable")}
        hint={t("indexableHint")}
        checked={status.indexable}
        disabled={busy}
        onChange={(next) => save({ indexable: next })}
      />
      <ToggleRow
        id={ids.owner}
        label={t("showOwner")}
        hint={t("showOwnerHint")}
        checked={status.showOwner}
        disabled={busy}
        onChange={(next) => save({ showOwner: next })}
      />

      {status.hiddenCount > 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {kind === "item" ? t("hiddenItem") : t("hiddenCollection", { count: status.hiddenCount })}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {status.usage.max != null ? (
        <p className={cn("text-xs", atCap ? "text-foreground" : "text-muted-foreground")}>
          {t("usage", { used: status.usage.used, max: status.usage.max })}{" "}
          <Link href="/upgrade" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("upgrade")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

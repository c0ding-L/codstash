"use client";

import { Copy, Crown, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { createApiToken } from "@/actions/api-tokens";
import { Field, useFieldErrors } from "@/components/items/item-form-fields";
import { McpSetupSnippets } from "@/components/settings/McpSetupSnippets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClipboard } from "@/i18n/labels";
import {
  API_TOKEN_EXPIRIES,
  API_TOKEN_NAME_MAX,
  API_TOKEN_SCOPES,
  DEFAULT_API_TOKEN_EXPIRY,
  type ApiTokenExpiry,
} from "@/lib/api-token-schema";
import type { ApiTokenScope } from "@/lib/db/api-tokens";

interface ApiTokenDialogProps {
  /** False on Free: the `write` scope is shown but disabled. */
  canWrite: boolean;
  /** The app's public origin, for the MCP snippets shown with the new token. */
  origin: string;
  onClose: () => void;
}

/**
 * Creates a token, then shows it once. The token lives only in this dialog's state:
 * closing it drops the token for good.
 */
export function ApiTokenDialog({ canWrite, origin, onClose }: ApiTokenDialogProps) {
  const t = useTranslations("settings.api");
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [token, setToken] = useState<string | null>(null);

  function close() {
    // The list shows the new token once the dialog is gone.
    if (token) router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && close()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        {token ? (
          <CreatedToken token={token} origin={origin} onDone={close} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("newTitle")}</DialogTitle>
              <DialogDescription>{t("dialogDescription")}</DialogDescription>
            </DialogHeader>
            <ApiTokenForm canWrite={canWrite} saving={saving} startSaving={startSaving} onCreated={setToken} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormField = "name" | "scope" | "expiry";

function ApiTokenForm({
  canWrite,
  saving,
  startSaving,
  onCreated,
}: {
  canWrite: boolean;
  saving: boolean;
  startSaving: React.TransitionStartFunction;
  onCreated: (token: string) => void;
}) {
  const t = useTranslations("settings.api");
  const tc = useTranslations("common");
  const id = useId();
  const { setError, messageFor, clearFor, fieldProps } = useFieldErrors<FormField>(id);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiTokenScope>("read");
  const [expiry, setExpiry] = useState<ApiTokenExpiry>(DEFAULT_API_TOKEN_EXPIRY);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;

    startSaving(async () => {
      const result = await createApiToken({ name, scope, expiry });
      if (!result.success) {
        toast.error(result.error);
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }
      toast.success(t("createdToast"));
      onCreated(result.data.token);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <Field id={`${id}-name`} label={t("name")} error={messageFor("name")}>
        <Input
          value={name}
          autoFocus
          maxLength={API_TOKEN_NAME_MAX}
          placeholder={t("namePlaceholder")}
          disabled={saving}
          {...fieldProps("name", setName)}
        />
      </Field>

      <Field
        id={`${id}-scope`}
        label={t("scope")}
        error={messageFor("scope")}
        hint={canWrite ? undefined : t("writeProOnly")}
      >
        <Select
          items={API_TOKEN_SCOPES.map((value) => ({ value, label: t(`scopes.${value}`) }))}
          value={scope}
          disabled={saving}
          onValueChange={(next: ApiTokenScope | null) => {
            if (next === null) return;
            setScope(next);
            clearFor("scope");
          }}
        >
          <SelectTrigger
            id={`${id}-scope`}
            aria-describedby={`${id}-scope-message`}
            aria-invalid={messageFor("scope") !== undefined || undefined}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {API_TOKEN_SCOPES.map((value) => {
              const locked = value === "write" && !canWrite;
              return (
                <SelectItem key={value} value={value} disabled={locked}>
                  {t(`scopes.${value}`)}
                  {locked ? <Crown className="text-amber-400" aria-label={t("writeProOnly")} /> : null}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>

      <Field id={`${id}-expiry`} label={t("expiry")} error={messageFor("expiry")}>
        <Select
          items={API_TOKEN_EXPIRIES.map((value) => ({ value, label: t(`expiries.${value}`) }))}
          value={expiry}
          disabled={saving}
          onValueChange={(next: ApiTokenExpiry | null) => {
            if (next === null) return;
            setExpiry(next);
            clearFor("expiry");
          }}
        >
          <SelectTrigger id={`${id}-expiry`} aria-describedby={`${id}-expiry-message`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {API_TOKEN_EXPIRIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`expiries.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          {tc("cancel")}
        </DialogClose>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? t("creating") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The token, shown this once, with a copy button and the MCP snippets filled with it. */
function CreatedToken({ token, origin, onDone }: { token: string; origin: string; onDone: () => void }) {
  const t = useTranslations("settings.api");
  const tm = useTranslations("settings.mcp");
  const { copyToClipboard } = useClipboard();
  const id = useId();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("createdTitle")}</DialogTitle>
        <DialogDescription className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {t("createdBody")}
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {t("tokenLabel")}
        </label>
        <Input
          id={id}
          value={token}
          readOnly
          autoFocus
          spellCheck={false}
          className="font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" size="icon" aria-label={t("copy")} title={t("copy")} onClick={() => void copyToClipboard(token)}>
          <Copy aria-hidden />
        </Button>
      </div>
      <details className="group min-w-0 rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{tm("title")}</summary>
        <div className="mt-3">
          <McpSetupSnippets origin={origin} token={token} />
        </div>
      </details>
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          {t("done")}
        </Button>
      </DialogFooter>
    </>
  );
}

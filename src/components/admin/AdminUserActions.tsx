"use client";

import { BadgeCheck, BadgeMinus, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteUserAccount, grantProToUser, revokeProFromUser } from "@/actions/admin";
import { DestructiveConfirmDialog, emphasizeName } from "@/components/DestructiveConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useRefreshAfterRemoval } from "@/hooks/use-refresh-after-removal";

interface AdminUserActionsProps {
  user: { id: string; email: string };
  /** Paid Pro running: Remove Pro is offered. */
  hasPaidPro: boolean;
  /** Admins (the viewer included) cannot be deleted from the panel. */
  deletable: boolean;
}

/** The row menu of /admin's user list: grant Pro, remove Pro, delete the account. */
export function AdminUserActions({ user, hasPaidPro, deletable }: AdminUserActionsProps) {
  const t = useTranslations("admin.actions");
  const router = useRouter();
  const refreshAfterRemoval = useRefreshAfterRemoval();
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t("menu", { email: user.email })}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => setGrantOpen(true)}>
            <BadgeCheck aria-hidden />
            {t("grant")}
          </DropdownMenuItem>
          {hasPaidPro ? (
            <DropdownMenuItem onClick={() => setRevokeOpen(true)}>
              <BadgeMinus aria-hidden />
              {t("revoke")}
            </DropdownMenuItem>
          ) : null}
          {deletable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                {t("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <GrantProDialog user={user} open={grantOpen} onOpenChange={setGrantOpen} />
      <DestructiveConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={t("revokeTitle")}
        body={t.rich("revokeBody", { email: user.email, name: emphasizeName })}
        confirmLabel={t("revoke")}
        pendingLabel={t("revoking")}
        action={() => revokeProFromUser({ userId: user.id })}
        successMessage={t("revoked")}
        onSuccess={() => router.refresh()}
      />
      {deletable ? (
        <DestructiveConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("deleteTitle")}
          body={t.rich("deleteBody", { email: user.email, name: emphasizeName })}
          action={() => deleteUserAccount({ userId: user.id })}
          successMessage={t("deleted")}
          onSuccess={() => refreshAfterRemoval(user.id)}
        />
      ) : null}
    </>
  );
}

const DEFAULT_GRANT_DAYS = 30;

function GrantProDialog({
  user,
  open,
  onOpenChange,
}: {
  user: { id: string; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.actions");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState(String(DEFAULT_GRANT_DAYS));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      // The action validates the range; a blank or decimal field fails there with its message.
      const result = await grantProToUser({ userId: user.id, days: Number(days) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("granted"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) setDays(String(DEFAULT_GRANT_DAYS));
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{t("grantTitle")}</DialogTitle>
          <DialogDescription>{t.rich("grantDescription", { email: user.email, name: emphasizeName })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("days")}
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={3650}
              step={1}
              required
              value={days}
              onChange={(event) => setDays(event.target.value)}
              disabled={pending}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("granting") : t("grant")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

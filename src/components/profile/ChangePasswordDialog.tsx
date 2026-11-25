"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { type ActionResult, changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = { success: false, error: null };

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("password");
  const searchParams = useSearchParams();
  const router = useRouter();

  // A successful change redirects back here with this flag, which is the only
  // way the re-issued session reaches the page.
  const changed = searchParams.get("passwordChanged") === "1";
  if (changed && open) setOpen(false);

  useEffect(() => {
    if (!changed) return;
    toast.success(t("changed"), { id: "password-changed" });
    router.replace("/profile", { scroll: false });
  }, [changed, router, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>{t("change")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("change")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm() {
  const t = useTranslations("password");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        {t("current")}
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("new")}
        <Input name="newPassword" type="password" autoComplete="new-password" required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("confirm")}
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <DialogFooter className="mt-1">
        <DialogClose render={<Button variant="outline" />} disabled={pending}>
          {tc("cancel")}
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("change")}
        </Button>
      </DialogFooter>
    </form>
  );
}

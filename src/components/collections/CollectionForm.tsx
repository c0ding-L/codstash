"use client";

import { useId, useState, type TransitionStartFunction } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { CreateCollectionField } from "@/actions/collections";
import { Field, useFieldErrors } from "@/components/items/item-form-fields";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface CollectionFormValues {
  name: string;
  description: string;
}

type SubmitResult = { success: true } | { success: false; error: string; field?: CreateCollectionField };

interface CollectionFormProps {
  initial?: CollectionFormValues;
  saving: boolean;
  startSaving: TransitionStartFunction;
  /** Calls the server action; the form shows its error and marks the field at fault. */
  submit: (values: CollectionFormValues) => Promise<SubmitResult>;
  onSaved: () => void;
  submitLabel: string;
  savingLabel: string;
}

/** The name and description fields of the new and edit collection dialogs. */
export function CollectionForm({
  initial = { name: "", description: "" },
  saving,
  startSaving,
  submit,
  onSaved,
  submitLabel,
  savingLabel,
}: CollectionFormProps) {
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const id = useId();
  const { setError, messageFor, fieldProps } = useFieldErrors<CreateCollectionField>(id);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const canSubmit = name.trim() !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    startSaving(async () => {
      const result = await submit({ name, description });
      if (!result.success) {
        toast.error(result.error);
        // The field at fault is also marked where it is.
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <Field id={`${id}-name`} label={t("name")} error={messageFor("name")}>
        <Input value={name} autoFocus {...fieldProps("name", setName)} />
      </Field>

      <Field id={`${id}-description`} label={t("description")} error={messageFor("description")}>
        <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          {tc("cancel")}
        </DialogClose>
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? savingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

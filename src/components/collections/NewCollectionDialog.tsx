"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { createCollection, type CreateCollectionField } from "@/actions/collections";
import { Field, useFieldErrors } from "@/components/items/item-form-fields";
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
import { Textarea } from "@/components/ui/textarea";

/** The top bar's "New Collection" button and the dialog it opens. */
export function NewCollectionDialog() {
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  return (
    // Kept open while saving, so a create in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : setOpen(next))}>
      <DialogTrigger render={<Button size="lg" variant="outline" className="ml-auto" aria-label="New Collection" />}>
        <FolderPlus aria-hidden />
        {/* Icon only on narrow screens, so both buttons fit beside the search. */}
        <span className="hidden sm:inline">New Collection</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Give it a name and, if you like, a description.</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <NewCollectionForm saving={saving} startSaving={startSaving} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface NewCollectionFormProps {
  saving: boolean;
  startSaving: TransitionStartFunction;
  onCreated: () => void;
}

function NewCollectionForm({ saving, startSaving, onCreated }: NewCollectionFormProps) {
  const router = useRouter();
  const id = useId();
  const { setError, messageFor, fieldProps } = useFieldErrors<CreateCollectionField>(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canSubmit = name.trim() !== "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    startSaving(async () => {
      const result = await createCollection({ name, description });
      if (!result.success) {
        toast.error(result.error);
        // The field at fault is also marked where it is.
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }

      toast.success("Collection created.");
      onCreated();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <Field id={`${id}-name`} label="Name" error={messageFor("name")}>
        <Input value={name} autoFocus {...fieldProps("name", setName)} />
      </Field>

      <Field id={`${id}-description`} label="Description" error={messageFor("description")}>
        <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? "Creating…" : "Create collection"}
        </Button>
      </DialogFooter>
    </form>
  );
}

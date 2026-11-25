"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface EditableCollection {
  id: string;
  name: string;
  description: string | null;
}

interface EditCollectionDialogProps {
  collection: EditableCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Edits a collection's name and description. Controlled, so a menu or a button can open it. */
export function EditCollectionDialog({ collection, open, onOpenChange }: EditCollectionDialogProps) {
  const t = useTranslations("collections.editDialog");
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  return (
    // Kept open while saving, so an update in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so every opening starts from the saved values. */}
        <CollectionForm
          initial={{ name: collection.name, description: collection.description ?? "" }}
          saving={saving}
          startSaving={startSaving}
          submit={(values) => updateCollection(collection.id, values)}
          onSaved={() => {
            toast.success(t("saved"));
            onOpenChange(false);
            router.refresh();
          }}
          submitLabel={t("submit")}
          savingLabel={t("saving")}
        />
      </DialogContent>
    </Dialog>
  );
}

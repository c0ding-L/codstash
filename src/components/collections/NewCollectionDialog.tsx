"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The top bar's "New Collection" button and the dialog it opens. */
export function NewCollectionDialog() {
  const router = useRouter();
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
        <CollectionForm
          saving={saving}
          startSaving={startSaving}
          submit={(values) => createCollection(values)}
          onSaved={() => {
            toast.success("Collection created.");
            setOpen(false);
            router.refresh();
          }}
          submitLabel="Create collection"
          savingLabel="Creating…"
        />
      </DialogContent>
    </Dialog>
  );
}

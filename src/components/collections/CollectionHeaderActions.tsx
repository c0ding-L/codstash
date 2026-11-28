"use client";

import { ClipboardCopy, FileDown, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog } from "@/components/collections/EditCollectionDialog";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { ShareDialog } from "@/components/share/ShareDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClipboard } from "@/i18n/labels";
import { CopyRefusedError } from "@/lib/clipboard";
import { CONTEXT_COPY_MAX_CHARS, contextFileName } from "@/lib/context-export";
import type { CollectionSummary } from "@/lib/db/collections";
import { downloadBlob } from "@/lib/download";
import { responseError } from "@/lib/response-error";

/** Favorite, share, edit and delete buttons in a collection page's header, and the context export menu. */
export function CollectionHeaderActions({ collection }: { collection: CollectionSummary }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const t = useTranslations("collections");
  const ts = useTranslations("share");
  const { copyFromPromise } = useClipboard();

  const contextUrl = `/api/collections/${encodeURIComponent(collection.id)}/context`;

  /** The context file's text; rejects with the route's message, or a generic one. */
  async function fetchContext() {
    let response: Response;
    try {
      response = await fetch(contextUrl);
    } catch {
      throw new CopyRefusedError(t("context.failed"));
    }
    if (!response.ok) throw new CopyRefusedError((await responseError(response)) ?? t("context.failed"));
    return response.text();
  }

  async function download() {
    setDownloading(true);
    try {
      const text = await fetchContext();
      const fileName = contextFileName(collection.name);
      downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), fileName);
      toast.success(t("context.done", { file: fileName }));
    } catch (error) {
      toast.error(error instanceof CopyRefusedError ? error.message : t("context.failed"));
    } finally {
      setDownloading(false);
    }
  }

  function copy() {
    // Started during the click, so Safari allows the clipboard write.
    void copyFromPromise(
      fetchContext().then((text) => {
        if (text.length > CONTEXT_COPY_MAX_CHARS) throw new CopyRefusedError(t("context.tooLong"));
        return text;
      }),
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <FavoriteButton
        kind="collection"
        id={collection.id}
        name={collection.name}
        isFavorite={collection.isFavorite}
        size="icon"
        className="text-foreground"
      />
      <Button variant="ghost" size="icon" aria-label={ts("action")} onClick={() => setShareOpen(true)}>
        <Share2 aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("deleteLabel")}
        className="text-destructive hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={t("actionsFor", { name: collection.name })} />}
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem disabled={downloading} onClick={() => void download()}>
            <FileDown aria-hidden />
            {t("context.export")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copy}>
            <ClipboardCopy aria-hidden />
            {t("context.copy")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog kind="collection" id={collection.id} open={shareOpen} onOpenChange={setShareOpen} />
      <EditCollectionDialog collection={collection} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectToList
      />
    </div>
  );
}

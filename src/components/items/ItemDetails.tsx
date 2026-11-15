"use client";

import {
  Braces,
  CalendarClock,
  CalendarPlus,
  Clock,
  Copy,
  Download,
  FileText,
  Folder,
  ImageIcon,
  HardDrive,
  type LucideIcon,
  Paperclip,
  Pencil,
  Pin,
  Shapes,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { ItemDeleteDialog } from "@/components/items/ItemDeleteDialog";
import { ItemEditForm, type SavedItem } from "@/components/items/ItemEditForm";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/clipboard";
import { isCodeType } from "@/lib/code-language";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { extensionOf } from "@/lib/files";
import { formatFileSize } from "@/lib/format";
import { colorClasses, surfaceClasses, toColorToken, toItemTypeSlug, typeIcons } from "@/lib/item-type-ui";
import { cn, isWebUrl } from "@/lib/utils";
import type { ItemTypeSlug } from "@/types/item-type";

export type ItemDetailState =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetailJson }
  | { status: "error" };

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** The drawer's title, next to the type's icon in the type's color, as on the cards. */
function DrawerHeader({ card, title }: { card: DashboardItem; title: string }) {
  const slug = toItemTypeSlug(card.type.slug);
  const color = toColorToken(card.type.color);
  const Icon = slug ? typeIcons[slug] : Clock;

  return (
    <SheetHeader className="flex-row items-center gap-3 pr-12">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          color && [surfaceClasses[color], colorClasses[color]],
        )}
        aria-hidden
      >
        <Icon className="size-4.5" />
      </span>
      <SheetTitle className="min-w-0 text-lg leading-snug font-semibold break-words">{title}</SheetTitle>
    </SheetHeader>
  );
}

interface IconActionProps extends React.ComponentProps<typeof Button> {
  label: string;
  /** What the tooltip says: the label, or why the action is not available. */
  hint: string;
  /** Icon only, with the label as its accessible name. Otherwise the label shows beside the icon. */
  iconOnly?: boolean;
  wrapperClassName?: string;
}

/**
 * An action button with a tooltip. The tooltip hangs on a wrapper because a
 * disabled button takes no pointer events, and these still need to explain why.
 */
function IconAction({ label, hint, iconOnly = false, wrapperClassName, children, ...props }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex", wrapperClassName)} />}>
        {iconOnly ? (
          <Button variant="ghost" size="icon" aria-label={label} {...props}>
            {children}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" {...props}>
            {children}
            {label}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

interface ActionBarProps {
  card: DashboardItem;
  detail: ItemDetailJson | null;
  /** Null until the detail has loaded: the form starts from it. */
  onEdit: (() => void) | null;
  /** Null until the detail has loaded, like `onEdit`. */
  onDelete: (() => void) | null;
}

/**
 * Favorite and Pin do not work yet. Favorite and Pin stay at full
 * opacity while disabled, because they still report the item's current state.
 */
function ActionBar({ card, detail, onEdit, onDelete }: ActionBarProps) {
  const copyText = detail ? detail.content || detail.url : null;

  return (
    <div className="flex items-center gap-1 border-y border-border px-4 py-2">
      <IconAction
        label="Favorite"
        hint={card.isFavorite ? "Favorite. Changing it is not available yet." : "Favorites are not available yet."}
        disabled
        aria-pressed={card.isFavorite}
        className={cn(card.isFavorite && "disabled:opacity-100")}
      >
        <Star className={cn(card.isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
      </IconAction>
      <IconAction
        label="Pin"
        hint={card.isPinned ? "Pinned. Changing it is not available yet." : "Pinning is not available yet."}
        disabled
        aria-pressed={card.isPinned}
        className={cn(card.isPinned && "disabled:opacity-100")}
      >
        <Pin className={cn(card.isPinned && "fill-current")} aria-hidden />
      </IconAction>
      <IconAction
        label="Copy"
        hint={!copyText ? "Nothing to copy" : detail?.content ? "Copy content" : "Copy URL"}
        disabled={!copyText}
        onClick={() => {
          if (copyText) void copyToClipboard(copyText);
        }}
      >
        <Copy aria-hidden />
      </IconAction>
      <IconAction label="Edit" hint="Edit" disabled={!onEdit} onClick={() => onEdit?.()}>
        <Pencil aria-hidden />
      </IconAction>
      <IconAction
        label="Delete"
        hint="Delete"
        iconOnly
        disabled={!onDelete}
        onClick={() => onDelete?.()}
        className="hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
        wrapperClassName="ml-auto"
      >
        <Trash2 aria-hidden />
      </IconAction>
    </div>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="inline-flex shrink-0 items-center gap-2 self-center text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

/** The body of the item: the part of the drawer that waits for the fetch. */
/** The uploaded file: its icon, name and extension, with the download button, in a light frame. */
function FileCard({ href, fileName, fileSize, isImage }: { href: string; fileName: string; fileSize: number | null; isImage: boolean }) {
  const Icon = isImage ? ImageIcon : FileText;
  const extension = extensionOf(fileName);

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background/60 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {[extension ? extension.toUpperCase() : null, fileSize ? formatFileSize(fileSize) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <a href={href} download={fileName} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
        <Download aria-hidden />
        Download
      </a>
    </div>
  );
}

function ItemBody({
  itemId,
  fileSize,
  state,
  slug,
}: {
  itemId: string;
  fileSize: number | null;
  state: ItemDetailState;
  slug: ItemTypeSlug | null;
}) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading item">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-muted-foreground">
        The rest of this item could not be loaded.
      </p>
    );
  }

  const { content, language, url, fileName } = state.detail;
  // Served by the app from the private bucket, for the owner only.
  const fileHref = `/api/items/${encodeURIComponent(itemId)}/download`;

  return (
    <>
      {fileName && slug === "image" ? (
        // From the download route, which next/image's optimiser could not reach with the session.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileHref}
          alt={fileName}
          className="max-h-80 w-full shrink-0 rounded-lg border border-border bg-muted/30 object-contain"
        />
      ) : null}

      {fileName ? (
        <FileCard href={fileHref} fileName={fileName} fileSize={fileSize} isImage={slug === "image"} />
      ) : null}

      {content && isCodeType(slug) ? (
        <CodeEditor value={content} language={language} ariaLabel="Content" />
      ) : content ? (
        <MarkdownEditor value={content} ariaLabel="Content" />
      ) : null}

      {url ? (
        isWebUrl(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-4"
          >
            {url}
          </a>
        ) : (
          <p className="break-all">{url}</p>
        )
      ) : null}
    </>
  );
}

interface ItemDetailsProps {
  card: DashboardItem;
  state: ItemDetailState;
  onSaved: (saved: SavedItem) => void;
  onDeleted: (itemId: string) => void;
}

export function ItemDetails({ card, state, onSaved, onDeleted }: ItemDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const slug = toItemTypeSlug(card.type.slug);
  const color = toColorToken(card.type.color);
  const TypeIcon = slug ? typeIcons[slug] : Clock;
  const detail = state.status === "ready" ? state.detail : null;

  const typeRow = (
    <DetailRow icon={Shapes} label="Type">
      <span className={cn("inline-flex items-center gap-1.5", color && colorClasses[color])}>
        <TypeIcon className="size-3.5" aria-hidden />
        {card.type.name}
      </span>
    </DetailRow>
  );
  const collectionRow = card.collectionName ? (
    <DetailRow icon={Folder} label="Collection">
      {card.collectionName}
    </DetailRow>
  ) : null;
  const updatedRow = (
    <DetailRow icon={CalendarClock} label="Updated">
      {formatDate(card.updatedAt)}
    </DetailRow>
  );

  if (editing && detail) {
    return (
      <>
        <DrawerHeader card={card} title={`Edit ${card.type.name.toLowerCase()}`} />
        <ItemEditForm
          card={card}
          detail={detail}
          slug={slug}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            onSaved(saved);
            setEditing(false);
          }}
        >
          <dl className="flex flex-col gap-2">
            {typeRow}
            {collectionRow}
            <DetailRow icon={CalendarPlus} label="Created">
              {formatDate(detail.createdAt)}
            </DetailRow>
            {updatedRow}
          </dl>
        </ItemEditForm>
      </>
    );
  }

  return (
    <>
      <DrawerHeader card={card} title={card.title} />

      <ActionBar
        card={card}
        detail={detail}
        onEdit={detail ? () => setEditing(true) : null}
        onDelete={detail ? () => setConfirmingDelete(true) : null}
      />
      <ItemDeleteDialog
        card={card}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDeleted={onDeleted}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {card.description ? <p className="text-muted-foreground">{card.description}</p> : null}

        <ItemBody itemId={card.id} fileSize={card.fileSize} state={state} slug={slug} />

        <Separator />

        <dl className="flex flex-col gap-2">
          {typeRow}
          {collectionRow}
          {detail?.language ? (
            <DetailRow icon={Braces} label="Language">
              {detail.language}
            </DetailRow>
          ) : null}
          {detail?.fileName ? (
            <DetailRow icon={Paperclip} label="File">
              {detail.fileName}
            </DetailRow>
          ) : null}
          {card.fileSize ? (
            <DetailRow icon={HardDrive} label="Size">
              {formatFileSize(card.fileSize)}
            </DetailRow>
          ) : null}
          {state.status === "loading" ? (
            <>
              <DetailRow icon={Tag} label="Tags">
                <Skeleton className="h-4 w-16" />
              </DetailRow>
              <DetailRow icon={CalendarPlus} label="Created">
                <Skeleton className="h-4 w-20" />
              </DetailRow>
            </>
          ) : null}
          {detail ? (
            <>
              <DetailRow icon={Tag} label="Tags">
                {detail.tags.length > 0 ? (
                  <span className="inline-flex flex-wrap justify-end gap-1">
                    {detail.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </DetailRow>
              <DetailRow icon={CalendarPlus} label="Created">
                {formatDate(detail.createdAt)}
              </DetailRow>
            </>
          ) : null}
          {updatedRow}
        </dl>
      </div>
    </>
  );
}

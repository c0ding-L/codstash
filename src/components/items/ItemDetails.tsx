"use client";

import {
  Braces,
  CalendarClock,
  CalendarPlus,
  Clock,
  Copy,
  Folder,
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
import { toast } from "sonner";

import { ItemEditForm, type SavedItem } from "@/components/items/ItemEditForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { formatFileSize } from "@/lib/format";
import { colorClasses, surfaceClasses, toColorToken, toItemTypeSlug, typeIcons } from "@/lib/item-type-ui";
import { cn, isWebUrl } from "@/lib/utils";

export type ItemDetailState =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetailJson }
  | { status: "error" };

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
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
  wrapperClassName?: string;
}

/**
 * An icon button with a tooltip. The tooltip hangs on a wrapper because a
 * disabled button takes no pointer events, and these still need to explain why.
 */
function IconAction({ label, hint, wrapperClassName, ...props }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex", wrapperClassName)} />}>
        <Button variant="ghost" size="icon" aria-label={label} {...props} />
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
}

/**
 * Favorite, Pin and Delete do not work yet. Favorite and Pin stay at full
 * opacity while disabled, because they still report the item's current state.
 */
function ActionBar({ card, detail, onEdit }: ActionBarProps) {
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
      <IconAction label="Delete" hint="Deleting is not available yet." disabled wrapperClassName="ml-auto">
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
function ItemBody({ state }: { state: ItemDetailState }) {
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

  const { content, url } = state.detail;

  return (
    <>
      {content ? (
        <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs break-words whitespace-pre-wrap">
          {content}
        </pre>
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
}

export function ItemDetails({ card, state, onSaved }: ItemDetailsProps) {
  const [editing, setEditing] = useState(false);
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

      <ActionBar card={card} detail={detail} onEdit={detail ? () => setEditing(true) : null} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {card.description ? <p className="text-muted-foreground">{card.description}</p> : null}

        <ItemBody state={state} />

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

"use client";

import { Copy, Pencil, Pin, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { copyToClipboard } from "@/lib/clipboard";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { cn } from "@/lib/utils";

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

interface ItemActionBarProps {
  card: DashboardItem;
  detail: ItemDetailJson | null;
  /** Null until the detail has loaded: the form starts from it. */
  onEdit: (() => void) | null;
  /** Null until the detail has loaded, like `onEdit`. */
  onDelete: (() => void) | null;
  /** Updates the drawer's copy of the card, which the page refresh does not reach. */
  onFavoriteChanged: (isFavorite: boolean) => void;
}

/**
 * Pin does not work yet. Favorite and Pin stay at full opacity while disabled,
 * because they still report the item's current state.
 */
export function ItemActionBar({ card, detail, onEdit, onDelete, onFavoriteChanged }: ItemActionBarProps) {
  const copyText = detail ? detail.content || detail.url : null;
  const favorite = useFavoriteToggle("item", card.id, card.isFavorite, onFavoriteChanged);

  return (
    <div className="flex items-center gap-1 border-y border-border px-4 py-2">
      <IconAction
        label="Favorite"
        hint={favorite.isFavorite ? "Remove from favorites" : "Add to favorites"}
        disabled={favorite.pending}
        aria-pressed={favorite.isFavorite}
        onClick={favorite.toggle}
        className="disabled:opacity-100"
      >
        <Star className={cn(favorite.isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
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

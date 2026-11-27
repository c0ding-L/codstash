"use client";

import { Copy, Pencil, Pin, Share2, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTemplateCopy } from "@/components/items/FillVariablesDialog";
import { ShareDialog } from "@/components/share/ShareDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { usePinToggle } from "@/hooks/use-pin-toggle";
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
  /** Like `onFavoriteChanged`, for the pin. */
  onPinnedChanged: (isPinned: boolean) => void;
}

/**
 * Favorite and Pin stay at full opacity while their action is pending, because
 * they still report the item's current state.
 */
export function ItemActionBar({ card, detail, onEdit, onDelete, onFavoriteChanged, onPinnedChanged }: ItemActionBarProps) {
  const t = useTranslations("drawer.actions");
  const tc = useTranslations("common");
  const { copyItemText, dialog } = useTemplateCopy();
  const copyText = detail ? detail.content || detail.url : null;
  // A custom type is never templated, whatever its slug.
  const typeSlug = card.type.isSystem ? card.type.slug : null;
  const favorite = useFavoriteToggle("item", card.id, card.isFavorite, onFavoriteChanged);
  const pin = usePinToggle(card.id, card.isPinned, onPinnedChanged);
  const ts = useTranslations("share");
  const [shareOpen, setShareOpen] = useState(false);
  // File and image items are left out of public sharing in v1.
  const shareable = card.fileName === null;

  return (
    <div className="flex items-center gap-1 border-y border-border px-4 py-2">
      <IconAction
        label={t("favorite")}
        hint={favorite.isFavorite ? t("removeFavorite") : t("addFavorite")}
        disabled={favorite.pending}
        aria-pressed={favorite.isFavorite}
        onClick={favorite.toggle}
        className="disabled:opacity-100"
      >
        <Star className={cn(favorite.isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
      </IconAction>
      <IconAction
        label={t("pin")}
        hint={pin.isPinned ? t("unpin") : t("pinToTop")}
        disabled={pin.pending}
        aria-pressed={pin.isPinned}
        onClick={pin.toggle}
        className="disabled:opacity-100"
      >
        <Pin className={cn(pin.isPinned && "fill-current")} aria-hidden />
      </IconAction>
      <IconAction
        label={t("copy")}
        hint={!copyText ? t("nothingToCopy") : detail?.content ? t("copyContent") : t("copyUrl")}
        disabled={!copyText}
        onClick={() => {
          if (copyText) copyItemText(copyText, { itemId: card.id, type: typeSlug });
        }}
      >
        <Copy aria-hidden />
      </IconAction>
      <IconAction label={tc("edit")} hint={tc("edit")} disabled={!onEdit} onClick={() => onEdit?.()}>
        <Pencil aria-hidden />
      </IconAction>
      {shareable ? (
        <IconAction label={ts("action")} hint={ts("titleItem")} iconOnly onClick={() => setShareOpen(true)}>
          <Share2 aria-hidden />
        </IconAction>
      ) : null}
      <IconAction
        label={tc("delete")}
        hint={tc("delete")}
        iconOnly
        disabled={!onDelete}
        onClick={() => onDelete?.()}
        className="hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
        wrapperClassName="ml-auto"
      >
        <Trash2 aria-hidden />
      </IconAction>
      {dialog}
      {shareable ? <ShareDialog kind="item" id={card.id} open={shareOpen} onOpenChange={setShareOpen} /> : null}
    </div>
  );
}

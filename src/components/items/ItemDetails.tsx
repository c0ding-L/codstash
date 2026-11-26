"use client";

import {
  Braces,
  CalendarClock,
  CalendarPlus,
  Folder,
  HardDrive,
  type LucideIcon,
  Paperclip,
  Shapes,
  Tag,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ItemActionBar } from "@/components/items/ItemActionBar";
import { ItemBody } from "@/components/items/ItemBody";
import { ItemDeleteDialog } from "@/components/items/ItemDeleteDialog";
import { ItemEditForm, type SavedItem } from "@/components/items/ItemEditForm";
import { TagBadges } from "@/components/items/TagBadges";
import { Separator } from "@/components/ui/separator";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { useFileSize, useTypeView } from "@/i18n/labels";
import { formatCollectionNames } from "@/lib/format";
import { colorClasses, fieldsSlugOf } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

export type ItemDetailState =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetailJson }
  | { status: "error" };

/** Client-only (the drawer opens in the browser), so the viewer's own time zone is right here. */
function formatDate(date: Date | string, locale: string) {
  return new Date(date).toLocaleDateString(locale, { dateStyle: "medium" });
}

/** The drawer's title, next to the type's icon in the type's color, as on the cards. */
function DrawerHeader({ card, title, language = null }: { card: DashboardItem; title: string; language?: string | null }) {
  const { Icon, color } = useTypeView()(card.type);
  return (
    <SheetHeader className="flex-row items-center gap-3 pr-12">
      <TypeIconTile
        icon={Icon}
        color={color}
        className="size-9 shrink-0 rounded-lg"
        iconClassName="size-4.5"
        mutedFallback
      />
      <SheetTitle className="min-w-0 text-lg leading-snug font-semibold break-words">{title}</SheetTitle>
      {/* A custom item's language, when set: its content is Markdown, so nothing else shows it up top. */}
      {language ? (
        <span className="shrink-0 rounded-sm border border-border px-1.5 font-mono text-xs text-muted-foreground">
          {language}
        </span>
      ) : null}
    </SheetHeader>
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

interface ItemDetailsProps {
  card: DashboardItem;
  state: ItemDetailState;
  onSaved: (saved: SavedItem) => void;
  onDeleted: (itemId: string) => void;
  onFavoriteChanged: (itemId: string, isFavorite: boolean) => void;
  onPinnedChanged: (itemId: string, isPinned: boolean) => void;
  /** For the AI buttons: the edit form's, the code editor's Explain and the prompt's Optimize. */
  aiAllowed: Promise<boolean>;
}

export function ItemDetails({ card, state, aiAllowed, onSaved, onDeleted, onFavoriteChanged, onPinnedChanged }: ItemDetailsProps) {
  const t = useTranslations("drawer");
  const tc = useTranslations("common");
  const tTypes = useTranslations("itemTypes");
  const locale = useLocale();
  const typeView = useTypeView();
  const formatFileSize = useFileSize();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const view = typeView(card.type);
  const { systemSlug, color, Icon: TypeIcon } = view;
  // A custom item has a note's fields, plus a language.
  const slug = fieldsSlugOf(view);
  const isCustom = !view.isSystem;
  const detail = state.status === "ready" ? state.detail : null;

  const typeRow = (
    <DetailRow icon={Shapes} label={t("type")}>
      <span className={cn("inline-flex items-center gap-1.5", colorClasses[color])}>
        <TypeIcon className="size-3.5" aria-hidden />
        {view.label}
      </span>
    </DetailRow>
  );
  const collectionNames = formatCollectionNames(card.collections);
  const collectionRow = collectionNames ? (
    <DetailRow icon={Folder} label={t("collections", { count: card.collections.length })}>
      {collectionNames}
    </DetailRow>
  ) : null;
  const updatedRow = (
    <DetailRow icon={CalendarClock} label={t("updated")}>
      {formatDate(card.updatedAt, locale)}
    </DetailRow>
  );

  if (editing && detail) {
    return (
      <>
        <DrawerHeader
          card={card}
          title={systemSlug ? tTypes(`${systemSlug}.edit`) : t("editTitle", { type: view.label })}
        />
        <ItemEditForm
          card={card}
          detail={detail}
          slug={slug}
          isCustom={isCustom}
          aiAllowed={aiAllowed}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            onSaved(saved);
            setEditing(false);
          }}
        >
          <dl className="flex flex-col gap-2">
            {typeRow}
            {collectionRow}
            <DetailRow icon={CalendarPlus} label={t("created")}>
              {formatDate(detail.createdAt, locale)}
            </DetailRow>
            {updatedRow}
          </dl>
        </ItemEditForm>
      </>
    );
  }

  return (
    <>
      <DrawerHeader card={card} title={card.title} language={isCustom ? (detail?.language ?? null) : null} />

      <ItemActionBar
        card={card}
        detail={detail}
        onEdit={detail ? () => setEditing(true) : null}
        onDelete={detail ? () => setConfirmingDelete(true) : null}
        onFavoriteChanged={(isFavorite) => onFavoriteChanged(card.id, isFavorite)}
        onPinnedChanged={(isPinned) => onPinnedChanged(card.id, isPinned)}
      />
      <ItemDeleteDialog
        card={card}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDeleted={onDeleted}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {card.description ? <p className="text-muted-foreground">{card.description}</p> : null}

        <ItemBody
          itemId={card.id}
          fileSize={card.fileSize}
          state={state}
          slug={slug}
          aiAllowed={aiAllowed}
          onSaved={onSaved}
        />

        <Separator />

        <dl className="flex flex-col gap-2">
          {typeRow}
          {collectionRow}
          {detail?.language ? (
            <DetailRow icon={Braces} label={t("language")}>
              {detail.language}
            </DetailRow>
          ) : null}
          {detail?.fileName ? (
            <DetailRow icon={Paperclip} label={t("file")}>
              {detail.fileName}
            </DetailRow>
          ) : null}
          {card.fileSize ? (
            <DetailRow icon={HardDrive} label={t("size")}>
              {formatFileSize(card.fileSize)}
            </DetailRow>
          ) : null}
          {state.status === "loading" ? (
            <>
              <DetailRow icon={Tag} label={t("tags")}>
                <Skeleton className="h-4 w-16" />
              </DetailRow>
              <DetailRow icon={CalendarPlus} label={t("created")}>
                <Skeleton className="h-4 w-20" />
              </DetailRow>
            </>
          ) : null}
          {detail ? (
            <>
              <DetailRow icon={Tag} label={t("tags")}>
                {detail.tags.length > 0 ? (
                  <TagBadges tags={detail.tags} className="inline-flex justify-end" />
                ) : (
                  <span className="text-muted-foreground">{tc("none")}</span>
                )}
              </DetailRow>
              <DetailRow icon={CalendarPlus} label={t("created")}>
                {formatDate(detail.createdAt, locale)}
              </DetailRow>
            </>
          ) : null}
          {updatedRow}
        </dl>
      </div>
    </>
  );
}

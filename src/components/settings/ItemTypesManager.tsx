"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteItemType } from "@/actions/item-types";
import { ProOnlyUpgrade } from "@/components/billing/ProOnlyUpgrade";
import { DestructiveConfirmDialog, emphasizeName } from "@/components/DestructiveConfirmDialog";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import { ItemTypeDialog, type EditableItemType } from "@/components/settings/ItemTypeDialog";
import { Button } from "@/components/ui/button";
import { DEFAULT_CUSTOM_COLOR, customTypeIcon, toColorToken } from "@/lib/item-type-ui";

export interface ManagedItemType {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  template: string | null;
  itemCount: number;
}

interface ItemTypesManagerProps {
  types: ManagedItemType[];
  /** False for Free accounts and once Pro has lapsed: creating and editing need Pro. */
  canEdit: boolean;
  /** At the cap, "New type" is disabled. */
  max: number;
}

const NEW_TYPE: EditableItemType = { id: null, name: "", icon: null, color: null, template: null };

/** Settings › Item types: the user's custom types, with New, Edit and Delete. */
export function ItemTypesManager({ types, canEdit, max }: ItemTypesManagerProps) {
  const t = useTranslations("settings.types");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState<EditableItemType | null>(null);
  const [deleting, setDeleting] = useState<ManagedItemType | null>(null);
  const atCap = types.length >= max;

  return (
    <div className="flex flex-col gap-4">
      {types.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {types.map((type) => {
            const color = toColorToken(type.color) ?? DEFAULT_CUSTOM_COLOR;
            return (
              <li key={type.id} className="flex items-center gap-3 p-3">
                <TypeIconTile
                  icon={customTypeIcon(type.icon)}
                  color={color}
                  className="size-8 shrink-0 rounded-lg"
                  iconClassName="size-4"
                />
                <Link href={`/items/${type.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {type.name}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {tc("itemCount", { count: type.itemCount })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("edit", { name: type.name })}
                  title={canEdit ? t("edit", { name: type.name }) : t("proOnly")}
                  disabled={!canEdit}
                  onClick={() => setEditing(type)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete", { name: type.name })}
                  title={t("delete", { name: type.name })}
                  onClick={() => setDeleting(type)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={atCap} onClick={() => setEditing(NEW_TYPE)}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
          {atCap ? <p className="text-sm text-muted-foreground">{t("atCap", { max })}</p> : null}
        </div>
      ) : (
        <ProOnlyUpgrade message={t("proOnly")} label={t("upgrade")} />
      )}

      {editing ? (
        <ItemTypeDialog type={editing} open onOpenChange={(open) => !open && setEditing(null)} />
      ) : null}
      {deleting ? (
        <DeleteItemTypeDialog type={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
      ) : null}
    </div>
  );
}

/** Asks before deleting a type; the action refuses while items still use it. */
function DeleteItemTypeDialog({
  type,
  onOpenChange,
}: {
  type: ManagedItemType;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.types");
  const router = useRouter();

  return (
    <DestructiveConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={t("deleteTitle")}
      body={t.rich("deleteBody", { type: type.name, name: emphasizeName })}
      action={() => deleteItemType(type.id)}
      successMessage={t("deleted")}
      onSuccess={() => router.refresh()}
    />
  );
}

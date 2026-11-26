"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { createItemType, updateItemType, type ItemTypeField } from "@/actions/item-types";
import { Field, useFieldErrors } from "@/components/items/item-form-fields";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CUSTOM_COLOR_TOKENS,
  CUSTOM_TYPE_ICONS,
  DEFAULT_CUSTOM_COLOR,
  DEFAULT_CUSTOM_ICON,
  colorClasses,
  surfaceClasses,
  toColorToken,
  type CustomIconKey,
} from "@/lib/item-type-ui";
import { CUSTOM_TYPE_LIMITS } from "@/lib/item-limits";
import { cn } from "@/lib/utils";
import type { ColorToken } from "@/types/item-type";

/** A custom type as the dialog edits it; null `id` creates one. */
export interface EditableItemType {
  id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  template: string | null;
}

interface ItemTypeDialogProps {
  type: EditableItemType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Creates or edits a custom item type. Controlled, so the list's buttons open it. */
export function ItemTypeDialog({ type, open, onOpenChange }: ItemTypeDialogProps) {
  const t = useTranslations("settings.types");
  const [saving, startSaving] = useTransition();
  const isNew = type.id === null;

  return (
    // Kept open while saving, so a save in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{isNew ? t("newTitle") : t("editTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so every opening starts from the saved values. */}
        <ItemTypeForm type={type} saving={saving} startSaving={startSaving} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ItemTypeForm({
  type,
  saving,
  startSaving,
  onSaved,
}: {
  type: EditableItemType;
  saving: boolean;
  startSaving: React.TransitionStartFunction;
  onSaved: () => void;
}) {
  const t = useTranslations("settings.types");
  const tc = useTranslations("common");
  const router = useRouter();
  const id = useId();
  const { setError, messageFor, clearFor, fieldProps } = useFieldErrors<ItemTypeField>(id);
  const [name, setName] = useState(type.name);
  const [icon, setIcon] = useState<CustomIconKey>(
    type.icon && Object.hasOwn(CUSTOM_TYPE_ICONS, type.icon) ? (type.icon as CustomIconKey) : DEFAULT_CUSTOM_ICON,
  );
  // A colour outside the custom palette (none can be saved now) starts on the default.
  const [color, setColor] = useState<ColorToken>(() => {
    const token = toColorToken(type.color);
    return token && (CUSTOM_COLOR_TOKENS as readonly ColorToken[]).includes(token) ? token : DEFAULT_CUSTOM_COLOR;
  });
  const [template, setTemplate] = useState(type.template ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;

    const input = { name, icon, color, template };
    startSaving(async () => {
      const result = type.id === null ? await createItemType(input) : await updateItemType(type.id, input);
      if (!result.success) {
        toast.error(result.error);
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }
      toast.success(type.id === null ? t("created") : t("saved"));
      onSaved();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <Field id={`${id}-name`} label={t("name")} error={messageFor("name")} hint={t("nameHint")}>
        <Input value={name} autoFocus maxLength={CUSTOM_TYPE_LIMITS.name} {...fieldProps("name", setName)} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-icon-label`} className="text-xs font-medium text-muted-foreground">
          {t("icon")}
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-icon-label`} className="grid grid-cols-8 gap-1.5">
          {(Object.keys(CUSTOM_TYPE_ICONS) as CustomIconKey[]).map((key) => {
            const Icon = CUSTOM_TYPE_ICONS[key];
            const selected = key === icon;
            return (
              <Button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`icons.${key}`)}
                title={t(`icons.${key}`)}
                variant="ghost"
                size="icon"
                disabled={saving}
                className={cn(selected && ["ring-1 ring-foreground/20", surfaceClasses[color]])}
                onClick={() => {
                  setIcon(key);
                  clearFor("icon");
                }}
              >
                <Icon className={cn(selected && colorClasses[color])} aria-hidden />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-color-label`} className="text-xs font-medium text-muted-foreground">
          {t("color")}
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-color-label`} className="flex flex-wrap gap-1.5">
          {CUSTOM_COLOR_TOKENS.map((token) => {
            const selected = token === color;
            return (
              <Button
                key={token}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`colors.${token}`)}
                title={t(`colors.${token}`)}
                variant="ghost"
                size="icon"
                disabled={saving}
                className={cn(surfaceClasses[token], selected && "ring-2 ring-foreground/40")}
                onClick={() => {
                  setColor(token);
                  clearFor("color");
                }}
              >
                <span className={cn("size-3 rounded-full bg-current", colorClasses[token])} aria-hidden />
              </Button>
            );
          })}
        </div>
      </div>

      <Field id={`${id}-template`} label={t("template")} error={messageFor("template")} hint={t("templateHint")}>
        <MarkdownEditor
          value={template}
          id={`${id}-template`}
          ariaLabel={t("template")}
          invalid={messageFor("template") !== undefined}
          describedBy={`${id}-template-message`}
          onChange={(value) => {
            setTemplate(value);
            clearFor("template");
          }}
        />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          {tc("cancel")}
        </DialogClose>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? t("saving") : type.id === null ? t("create") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useId, useTransition } from "react";
import { toast } from "sonner";

import { updateItem, type UpdateItemField, type UpdateItemInput } from "@/actions/items";
import { GenerateDescriptionButton } from "@/components/items/GenerateDescription";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { SuggestTagsButton, TagSuggestionList } from "@/components/items/SuggestTags";
import {
  CollectionsField,
  ContentField,
  Field,
  LanguageField,
  TagsField,
  useFieldErrors,
  useItemFields,
} from "@/components/items/item-form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useRefreshAfterRemoval } from "@/hooks/use-refresh-after-removal";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { hasContentField, hasLanguageField, hasUrlField } from "@/lib/item-type-ui";
import { collectionIdFromPath } from "@/lib/pagination";
import type { ItemTypeSlug } from "@/types/item-type";

export interface SavedItem {
  card: DashboardItem;
  detail: ItemDetailJson;
}

interface ItemEditFormProps {
  card: DashboardItem;
  detail: ItemDetailJson;
  slug: ItemTypeSlug | null;
  /** A custom type's item: a note's fields plus a language. */
  isCustom: boolean;
  onCancel: () => void;
  onSaved: (saved: SavedItem) => void;
  /** From the server's plan check; the Suggest Tags button is hidden while it is false. */
  aiAllowed: Promise<boolean>;
  /** The fields that stay read-only, shown below the inputs. */
  children: React.ReactNode;
}

export function ItemEditForm({ card, detail, slug, isCustom, onCancel, onSaved, aiAllowed, children }: ItemEditFormProps) {
  const t = useTranslations("itemForm");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const refreshAfterRemoval = useRefreshAfterRemoval();
  const id = useId();
  const [saving, startSaving] = useTransition();
  const { setError, messageFor, clearFor, fieldProps } = useFieldErrors<UpdateItemField>(id);

  const hasContent = hasContentField(slug);
  const hasLanguage = isCustom || hasLanguageField(slug);
  const hasUrl = hasUrlField(slug);
  const fields = useItemFields({
    initial: {
      title: card.title,
      description: card.description ?? "",
      tags: detail.tags.join(", "),
      collectionIds: card.collections.map(({ id: collectionId }) => collectionId),
      content: detail.content ?? "",
      language: detail.language ?? "",
      url: detail.url ?? "",
    },
    hasContent,
    hasLanguage,
    hasUrl,
    onTagAccepted: () => clearFor("tags"),
  });
  const { title, setTitle, description, setDescription, tags, setTags, collectionIds, setCollectionIds } = fields;
  const { content, setContent, language, setLanguage, url, setUrl, tagSuggestions } = fields;

  const secretCheck = useSecretCheck();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.canSubmit || saving) return;

    // Only the fields this type shows: a field left out keeps its stored value.
    const input: UpdateItemInput = fields.input;
    secretCheck.check(fields.secretFields, "save", () => save(input));
  }

  function save(input: UpdateItemInput) {
    startSaving(async () => {
      const result = await updateItem(card.id, input);
      if (!result.success) {
        toast.error(result.error);
        // The field at fault is also marked where it is.
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }

      toast.success(t("saved"));
      onSaved(result.data);
      // Taken out of the collection this page lists, the item leaves the listing.
      const listed = collectionIdFromPath(pathname);
      const leftListing =
        listed !== null && !result.data.card.collections.some((collection) => collection.id === listed);
      refreshAfterRemoval(leftListing ? card.id : null);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      {secretCheck.dialog}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto border-t border-border p-4">
        <Field id={`${id}-title`} label={t("title")} error={messageFor("title")}>
          <Input value={title} {...fieldProps("title", setTitle)} />
        </Field>

        <Field
          id={`${id}-description`}
          label={t("description")}
          error={messageFor("description")}
          action={
            <GenerateDescriptionButton
              aiAllowed={aiAllowed}
              disabled={saving}
              // A custom type's name tells the model more than "note".
              input={fields.descriptionInput(isCustom ? card.type.name : slug, detail.fileName)}
              onGenerated={(text) => {
                setDescription(text);
                clearFor("description");
              }}
            />
          }
        >
          <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
        </Field>

        {hasLanguage ? (
          <LanguageField
            id={id}
            value={language}
            error={messageFor("language")}
            onChange={(value) => {
              setLanguage(value);
              clearFor("language");
            }}
          />
        ) : null}

        {hasContent ? (
          <ContentField
            id={id}
            slug={slug}
            value={content}
            language={language}
            error={messageFor("content")}
            onChange={(value) => {
              setContent(value);
              clearFor("content");
            }}
          />
        ) : null}

        {hasUrl ? (
          <Field id={`${id}-url`} label={t("url")} error={messageFor("url")}>
            <Input value={url} inputMode="url" placeholder="https://" {...fieldProps("url", setUrl)} />
          </Field>
        ) : null}

        <TagsField
          id={id}
          value={tags}
          error={messageFor("tags")}
          inputProps={fieldProps("tags", setTags)}
          action={<SuggestTagsButton aiAllowed={aiAllowed} state={tagSuggestions} disabled={saving} />}
          below={<TagSuggestionList state={tagSuggestions} disabled={saving} />}
        />

        <CollectionsField
          id={id}
          value={collectionIds}
          known={card.collections}
          error={messageFor("collectionIds")}
          disabled={saving}
          onChange={(ids) => {
            setCollectionIds(ids);
            clearFor("collectionIds");
          }}
        />

        <Separator />

        {children}
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={saving || !fields.canSubmit}>
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}

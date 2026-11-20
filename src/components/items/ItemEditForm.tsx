"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateItem, type UpdateItemField, type UpdateItemInput } from "@/actions/items";
import { CollectionsField, ContentField, Field, TagsField, useFieldErrors } from "@/components/items/item-form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import { hasContentField, hasLanguageField, hasUrlField } from "@/lib/item-type-ui";
import { toTags } from "@/lib/tags";
import type { ItemTypeSlug } from "@/types/item-type";

export interface SavedItem {
  card: DashboardItem;
  detail: ItemDetailJson;
}

interface ItemEditFormProps {
  card: DashboardItem;
  detail: ItemDetailJson;
  slug: ItemTypeSlug | null;
  onCancel: () => void;
  onSaved: (saved: SavedItem) => void;
  /** The fields that stay read-only, shown below the inputs. */
  children: React.ReactNode;
}

export function ItemEditForm({ card, detail, slug, onCancel, onSaved, children }: ItemEditFormProps) {
  const router = useRouter();
  const id = useId();
  const [saving, startSaving] = useTransition();
  const { setError, messageFor, clearFor, fieldProps } = useFieldErrors<UpdateItemField>(id);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [tags, setTags] = useState(detail.tags.join(", "));
  const [collectionIds, setCollectionIds] = useState(() => card.collections.map(({ id: collectionId }) => collectionId));
  const [content, setContent] = useState(detail.content ?? "");
  const [language, setLanguage] = useState(detail.language ?? "");
  const [url, setUrl] = useState(detail.url ?? "");

  const hasContent = hasContentField(slug);
  const hasLanguage = hasLanguageField(slug);
  const hasUrl = hasUrlField(slug);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Only the fields this type shows: a field left out keeps its stored value.
    const input: UpdateItemInput = {
      title,
      description,
      tags: toTags(tags),
      collectionIds,
      ...(hasContent && { content }),
      ...(hasLanguage && { language }),
      ...(hasUrl && { url }),
    };

    startSaving(async () => {
      const result = await updateItem(card.id, input);
      if (!result.success) {
        toast.error(result.error);
        // The field at fault is also marked where it is.
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }

      toast.success("Changes saved.");
      onSaved(result.data);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto border-t border-border p-4">
        <Field id={`${id}-title`} label="Title" error={messageFor("title")}>
          <Input value={title} {...fieldProps("title", setTitle)} />
        </Field>

        <Field id={`${id}-description`} label="Description" error={messageFor("description")}>
          <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
        </Field>

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

        {hasLanguage ? (
          <Field id={`${id}-language`} label="Language" error={messageFor("language")}>
            <Input value={language} placeholder="e.g. typescript" {...fieldProps("language", setLanguage)} />
          </Field>
        ) : null}

        {hasUrl ? (
          <Field id={`${id}-url`} label="URL" error={messageFor("url")}>
            <Input value={url} inputMode="url" placeholder="https://" {...fieldProps("url", setUrl)} />
          </Field>
        ) : null}

        <TagsField id={id} value={tags} error={messageFor("tags")} inputProps={fieldProps("tags", setTags)} />

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
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

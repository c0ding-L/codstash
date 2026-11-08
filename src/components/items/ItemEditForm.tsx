"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateItem, type UpdateItemField, type UpdateItemInput } from "@/actions/items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardItem, ItemDetailJson } from "@/lib/db/items";
import type { ItemTypeSlug } from "@/types/item-type";

const CONTENT_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["snippet", "prompt", "command", "note"]);
const LANGUAGE_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["snippet", "command"]);
const URL_TYPES: ReadonlySet<ItemTypeSlug> = new Set(["link"]);

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

interface FieldProps {
  id: string;
  label: string;
  /** Shown under the input, in place of `hint`. */
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-message`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** The tags as they will be saved: trimmed, without blanks or repeats. */
export function toTags(text: string) {
  const tags = text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

export function ItemEditForm({ card, detail, slug, onCancel, onSaved, children }: ItemEditFormProps) {
  const router = useRouter();
  const id = useId();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<{ field: UpdateItemField; message: string } | null>(null);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [tags, setTags] = useState(detail.tags.join(", "));
  const [content, setContent] = useState(detail.content ?? "");
  const [language, setLanguage] = useState(detail.language ?? "");
  const [url, setUrl] = useState(detail.url ?? "");

  const hasContent = slug !== null && CONTENT_TYPES.has(slug);
  const hasLanguage = slug !== null && LANGUAGE_TYPES.has(slug);
  const hasUrl = slug !== null && URL_TYPES.has(slug);
  const parsedTags = toTags(tags);

  /** Props tying an input to its label and message, and marking it while it is at fault. */
  function fieldProps(field: UpdateItemField, setValue: (value: string) => void) {
    const invalid = error?.field === field;
    return {
      id: `${id}-${field}`,
      "aria-invalid": invalid || undefined,
      "aria-describedby": `${id}-${field}-message`,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(event.target.value);
        if (invalid) setError(null);
      },
    };
  }
  const messageFor = (field: UpdateItemField) => (error?.field === field ? error.message : undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Only the fields this type shows: a field left out keeps its stored value.
    const input: UpdateItemInput = {
      title,
      description,
      tags: parsedTags,
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
          <Field id={`${id}-content`} label="Content" error={messageFor("content")}>
            <Textarea
              value={content}
              spellCheck={false}
              className="min-h-40 resize-none font-mono text-xs md:text-xs"
              {...fieldProps("content", setContent)}
            />
          </Field>
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

        <Field
          id={`${id}-tags`}
          label="Tags"
          error={messageFor("tags")}
          hint={
            parsedTags.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {parsedTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </span>
            ) : (
              "Separate tags with commas."
            )
          }
        >
          <Input value={tags} placeholder="react, hooks" {...fieldProps("tags", setTags)} />
        </Field>

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

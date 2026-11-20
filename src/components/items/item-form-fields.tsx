"use client";

import { useState } from "react";

import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { TagBadges } from "@/components/items/TagBadges";
import { Input } from "@/components/ui/input";
import { isCodeType } from "@/lib/code-language";
import { toTags } from "@/lib/tags";
import type { ItemTypeSlug } from "@/types/item-type";

interface FieldProps {
  id: string;
  label: string;
  /** Shown under the input, in place of `hint`. */
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

/** A labelled input with its error or hint below, tied to it by `${id}-message`. */
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

/**
 * The one field an item form marks as at fault, from its own check or the
 * server's answer. Editing that field clears the mark.
 */
export function useFieldErrors<F extends string>(id: string) {
  const [error, setError] = useState<{ field: F; message: string } | null>(null);

  const isInvalid = (field: F) => error?.field === field;
  const messageFor = (field: F) => (error?.field === field ? error.message : undefined);
  /** Clears the mark when it is on this field. */
  const clearFor = (field: F) => {
    if (error?.field === field) setError(null);
  };

  /** Props tying an input to its label and message, and marking it while it is at fault. */
  function fieldProps(field: F, setValue: (value: string) => void) {
    const invalid = isInvalid(field);
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

  return { error, setError, isInvalid, messageFor, clearFor, fieldProps };
}

interface ContentFieldProps {
  /** The form's `useId`; the field's id is `${id}-content`. */
  id: string;
  slug: ItemTypeSlug | null;
  value: string;
  language: string;
  error?: string;
  onChange: (value: string) => void;
}

/** The content: Monaco for code types, the Markdown editor for the others. */
export function ContentField({ id, slug, value, language, error, onChange }: ContentFieldProps) {
  const fieldId = `${id}-content`;

  return (
    <Field id={fieldId} label="Content" error={error}>
      {isCodeType(slug) ? (
        <CodeEditor value={value} language={language} ariaLabel="Content" onChange={onChange} />
      ) : (
        <MarkdownEditor
          value={value}
          id={fieldId}
          ariaLabel="Content"
          invalid={error !== undefined}
          describedBy={`${fieldId}-message`}
          onChange={onChange}
        />
      )}
    </Field>
  );
}

interface TagsFieldProps {
  /** The form's `useId`; the field's id is `${id}-tags`. */
  id: string;
  value: string;
  error?: string;
  /** From `fieldProps("tags", …)`. */
  inputProps: React.ComponentProps<typeof Input>;
}

/** The comma-separated tags, previewed as badges as they will be saved. */
export function TagsField({ id, value, error, inputProps }: TagsFieldProps) {
  const tags = toTags(value);

  return (
    <Field
      id={`${id}-tags`}
      label="Tags"
      error={error}
      hint={tags.length > 0 ? <TagBadges tags={tags} /> : "Separate tags with commas."}
    >
      <Input value={value} placeholder="react, hooks" {...inputProps} />
    </Field>
  );
}

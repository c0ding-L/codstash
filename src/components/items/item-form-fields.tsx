"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { TagBadges } from "@/components/items/TagBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CollectionOption } from "@/lib/db/collections";
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

type CollectionOptionsState =
  | { status: "loading" }
  | { status: "ready"; options: CollectionOption[] }
  | { status: "error" };

/**
 * The user's collections, read from `/api/collections` when the form mounts.
 * Both forms mount when they open, so a collection made a moment ago is listed.
 */
function useCollectionOptions(): CollectionOptionsState {
  const [state, setState] = useState<CollectionOptionsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/collections", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setState({ status: "ready", options: (await response.json()) as CollectionOption[] });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("[items] could not load collections:", error);
          setState({ status: "error" });
        }
      });
    return () => controller.abort();
  }, []);

  return state;
}

interface CollectionsFieldProps {
  /** The form's `useId`; the field's id is `${id}-collectionIds`. */
  id: string;
  value: string[];
  /** Names for ids already chosen, shown before the options arrive. */
  known?: CollectionOption[];
  error?: string;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}

/** A multi-select of the user's collections, the chosen ones listed as removable badges. */
export function CollectionsField({ id, value, known = [], error, disabled, onChange }: CollectionsFieldProps) {
  const fieldId = `${id}-collectionIds`;
  const state = useCollectionOptions();
  const options = state.status === "ready" ? state.options : [];

  const nameOf = new Map([...known, ...options].map(({ id: optionId, name }) => [optionId, name]));
  const chosen = value.map((optionId) => ({ id: optionId, name: nameOf.get(optionId) ?? "Unknown collection" }));

  const toggle = (optionId: string, checked: boolean) =>
    onChange(checked ? [...value, optionId] : value.filter((other) => other !== optionId));

  const placeholder =
    state.status === "loading"
      ? "Loading collections…"
      : state.status === "error"
        ? "Could not load collections"
        : options.length === 0
          ? "No collections yet"
          : value.length === 0
            ? "Choose collections"
            : `${value.length} selected`;

  return (
    <Field
      id={fieldId}
      label="Collections"
      error={error}
      hint={
        chosen.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {chosen.map(({ id: optionId, name }) => (
              <Badge key={optionId} variant="secondary" className="pr-0.5">
                {name}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-foreground/10 disabled:pointer-events-none"
                  aria-label={`Remove from ${name}`}
                  disabled={disabled}
                  onClick={() => toggle(optionId, false)}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            ))}
          </span>
        ) : undefined
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              id={fieldId}
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-invalid={error !== undefined || undefined}
              aria-describedby={`${fieldId}-message`}
              disabled={disabled || state.status !== "ready" || options.length === 0}
            />
          }
        >
          <span className={value.length === 0 ? "text-muted-foreground" : undefined}>{placeholder}</span>
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={value.includes(option.id)}
              onCheckedChange={(checked) => toggle(option.id, checked)}
            >
              <span className="truncate">{option.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Field>
  );
}

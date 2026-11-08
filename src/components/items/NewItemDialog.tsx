"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { type CreatableType, createItem, type CreateItemField, type CreateItemInput } from "@/actions/items";
import { Field, toTags } from "@/components/items/ItemEditForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { colorClasses, surfaceClasses, typeColors, typeIcons } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

const TYPES: { slug: CreatableType; label: string }[] = [
  { slug: "snippet", label: "Snippet" },
  { slug: "prompt", label: "Prompt" },
  { slug: "command", label: "Command" },
  { slug: "note", label: "Note" },
  { slug: "link", label: "Link" },
];

const CONTENT_TYPES: ReadonlySet<CreatableType> = new Set(["snippet", "prompt", "command", "note"]);
const LANGUAGE_TYPES: ReadonlySet<CreatableType> = new Set(["snippet", "command"]);

/** The top bar's "New Item" button and the dialog it opens. */
export function NewItemDialog() {
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  return (
    // Kept open while saving, so a create in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : setOpen(next))}>
      <DialogTrigger render={<Button size="lg" className="ml-auto" />}>
        <Plus aria-hidden />
        New Item
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Choose a type, then fill in its fields.</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <NewItemForm saving={saving} startSaving={startSaving} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface NewItemFormProps {
  saving: boolean;
  startSaving: TransitionStartFunction;
  onCreated: () => void;
}

function NewItemForm({ saving, startSaving, onCreated }: NewItemFormProps) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<{ field: CreateItemField; message: string } | null>(null);

  const [type, setType] = useState<CreatableType>("snippet");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("");
  const [url, setUrl] = useState("");

  const hasContent = CONTENT_TYPES.has(type);
  const hasLanguage = LANGUAGE_TYPES.has(type);
  const hasUrl = type === "link";
  const parsedTags = toTags(tags);
  const canSubmit = title.trim() !== "" && (!hasUrl || url.trim() !== "");

  /** Props tying an input to its label and message, and marking it while it is at fault. */
  function fieldProps(field: CreateItemField, setValue: (value: string) => void) {
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
  const messageFor = (field: CreateItemField) => (error?.field === field ? error.message : undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    // Only the fields this type shows: text typed under another type is not sent.
    const input: CreateItemInput = {
      type,
      title,
      description,
      tags: parsedTags,
      ...(hasContent && { content }),
      ...(hasLanguage && { language }),
      ...(hasUrl && { url }),
    };

    startSaving(async () => {
      const result = await createItem(input);
      if (!result.success) {
        toast.error(result.error);
        // The field at fault is also marked where it is.
        if (result.field) setError({ field: result.field, message: result.error });
        return;
      }

      toast.success("Item created.");
      onCreated();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
        {TYPES.map(({ slug, label }) => {
          const Icon = typeIcons[slug];
          const color = typeColors[slug];
          const selected = slug === type;
          return (
            <Button
              key={slug}
              type="button"
              role="radio"
              aria-checked={selected}
              variant="ghost"
              size="sm"
              className={cn(selected && ["ring-1 ring-foreground/20", surfaceClasses[color]])}
              onClick={() => {
                setType(slug);
                setError(null);
              }}
            >
              <Icon className={colorClasses[color]} aria-hidden />
              {label}
            </Button>
          );
        })}
      </div>

      <Field id={`${id}-title`} label="Title" error={messageFor("title")}>
        <Input value={title} autoFocus {...fieldProps("title", setTitle)} />
      </Field>

      <Field id={`${id}-description`} label="Description" error={messageFor("description")}>
        <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
      </Field>

      {hasUrl ? (
        <Field id={`${id}-url`} label="URL" error={messageFor("url")}>
          <Input value={url} inputMode="url" placeholder="https://" {...fieldProps("url", setUrl)} />
        </Field>
      ) : null}

      {hasContent ? (
        <Field id={`${id}-content`} label="Content" error={messageFor("content")}>
          <Textarea
            value={content}
            spellCheck={false}
            className="max-h-64 min-h-32 resize-none font-mono text-xs md:text-xs"
            {...fieldProps("content", setContent)}
          />
        </Field>
      ) : null}

      {hasLanguage ? (
        <Field id={`${id}-language`} label="Language" error={messageFor("language")}>
          <Input value={language} placeholder="e.g. typescript" {...fieldProps("language", setLanguage)} />
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

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving || !canSubmit}>
          {saving ? "Creating…" : "Create item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, use, useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { type CreatableType, createItem, type CreateItemField, type CreateItemInput } from "@/actions/items";
import { FileUpload } from "@/components/items/FileUpload";
import { GenerateDescriptionButton } from "@/components/items/GenerateDescription";
import { SuggestTagsButton, TagSuggestionList, useTagSuggestions } from "@/components/items/SuggestTags";
import { CollectionsField, ContentField, Field, LanguageField, TagsField, useFieldErrors } from "@/components/items/item-form-fields";
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
import { isUploadKind } from "@/lib/files";
import {
  colorClasses,
  hasContentField,
  hasLanguageField,
  hasUrlField,
  itemTypeFromPathname,
  surfaceClasses,
  typeColors,
  typeIcons,
} from "@/lib/item-type-ui";
import { addTag, toTags } from "@/lib/tags";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

const TYPES: { slug: CreatableType; label: string }[] = [
  { slug: "snippet", label: "Snippet" },
  { slug: "prompt", label: "Prompt" },
  { slug: "command", label: "Command" },
  { slug: "note", label: "Note" },
  { slug: "file", label: "File" },
  { slug: "image", label: "Image" },
  { slug: "link", label: "Link" },
];

interface NewItemDialogProps {
  /** From the server's plan check; File and Image are disabled while it is false. */
  uploadsAllowed: Promise<boolean>;
  /** From the server's plan check; the Suggest Tags button is hidden while it is false. */
  aiAllowed: Promise<boolean>;
  /** The button's text. The top bar's is "New Item"; type pages say "New Snippet" and so on. */
  label?: string;
  /** The top bar shows only the icon on narrow screens; the type pages always show the text. */
  iconOnlyOnMobile?: boolean;
}

/**
 * A "New Item" button and the dialog it opens: in the top bar, and on the type
 * pages, where the dialog starts on the page's type.
 */
export function NewItemDialog({ uploadsAllowed, aiAllowed, label = "New Item", iconOnlyOnMobile = true }: NewItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  return (
    // Kept open while saving, so a create in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : setOpen(next))}>
      <DialogTrigger render={<Button size="lg" aria-label={label} />}>
        <Plus aria-hidden />
        {/* In the top bar, icon only on narrow screens, like "New Collection". */}
        <span className={cn(iconOnlyOnMobile && "hidden sm:inline")}>{label}</span>
      </DialogTrigger>
      {/* Capped to the viewport and scrollable: a long snippet would push "Create item" off screen. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Choose a type, then fill in its fields.</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <Suspense fallback={null}>
          <NewItemForm
            saving={saving}
            startSaving={startSaving}
            onCreated={() => setOpen(false)}
            uploadsAllowed={uploadsAllowed}
            aiAllowed={aiAllowed}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

interface NewItemFormProps {
  saving: boolean;
  startSaving: TransitionStartFunction;
  onCreated: () => void;
  uploadsAllowed: Promise<boolean>;
  aiAllowed: Promise<boolean>;
}

function NewItemForm({ saving, startSaving, onCreated, uploadsAllowed, aiAllowed }: NewItemFormProps) {
  const canUpload = use(uploadsAllowed);
  const router = useRouter();
  const id = useId();
  const { setError, isInvalid, messageFor, clearFor, fieldProps } = useFieldErrors<CreateItemField>(id);

  // Starts on the type of the listing page it was opened from, when that type can be created here.
  const pageType = itemTypeFromPathname(usePathname());
  const [type, setType] = useState<CreatableType>(
    () => TYPES.find(({ slug }) => slug === pageType && (canUpload || !isUploadKind(slug)))?.slug ?? "snippet",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const hasContent = hasContentField(type);
  const hasLanguage = hasLanguageField(type);
  const hasUrl = hasUrlField(type);
  const tagSuggestions = useTagSuggestions({
    title,
    content: hasContent ? content : null,
    tags,
    onAccept: (tag) => {
      setTags((current) => addTag(current, tag));
      clearFor("tags");
    },
  });
  const uploadKind = isUploadKind(type) ? type : null;
  const canSubmit = title.trim() !== "" && (!hasUrl || url.trim() !== "") && (!uploadKind || file !== null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    // Only the fields this type shows: text typed under another type is not sent.
    const input: CreateItemInput = {
      type,
      title,
      description,
      tags: toTags(tags),
      collectionIds,
      ...(hasContent && { content }),
      ...(hasLanguage && { language }),
      ...(hasUrl && { url }),
    };

    startSaving(async () => {
      if (uploadKind && file) {
        setProgress(0);
        try {
          input.fileKey = await uploadFile(uploadKind, file, setProgress);
        } catch (uploadError) {
          setProgress(null);
          const message = uploadError instanceof Error ? uploadError.message : "Could not upload the file.";
          toast.error(message);
          setError({ field: "fileKey", message });
          return;
        }
      }

      const result = await createItem(input);
      if (!result.success) {
        setProgress(null);
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
      <TypePicker
        value={type}
        disabled={saving}
        canUpload={canUpload}
        onChange={(slug) => {
          // A file chosen as one kind is not valid as the other.
          if (slug !== type) setFile(null);
          setType(slug);
          setError(null);
        }}
      />

      <Field id={`${id}-title`} label="Title" error={messageFor("title")}>
        <Input value={title} autoFocus {...fieldProps("title", setTitle)} />
      </Field>

      <Field
        id={`${id}-description`}
        label="Description"
        error={messageFor("description")}
        action={
          <GenerateDescriptionButton
            aiAllowed={aiAllowed}
            disabled={saving}
            input={{
              type,
              title,
              content: hasContent ? content : null,
              language: hasLanguage ? language : null,
              url: hasUrl ? url : null,
              fileName: uploadKind ? (file?.name ?? null) : null,
              tags: toTags(tags),
            }}
            onGenerated={(text) => {
              setDescription(text);
              clearFor("description");
            }}
          />
        }
      >
        <Textarea value={description} className="resize-none" {...fieldProps("description", setDescription)} />
      </Field>

      {uploadKind ? (
        <Field id={`${id}-fileKey`} label={uploadKind === "image" ? "Image" : "File"} error={messageFor("fileKey")}>
          <FileUpload
            kind={uploadKind}
            file={file}
            id={`${id}-fileKey`}
            invalid={isInvalid("fileKey")}
            describedBy={`${id}-fileKey-message`}
            progress={progress}
            disabled={saving}
            onFileChange={(next) => {
              setFile(next);
              clearFor("fileKey");
            }}
            onReject={(message) => setError({ field: "fileKey", message })}
          />
        </Field>
      ) : null}

      {hasUrl ? (
        <Field id={`${id}-url`} label="URL" error={messageFor("url")}>
          <Input value={url} inputMode="url" placeholder="https://" {...fieldProps("url", setUrl)} />
        </Field>
      ) : null}

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
          slug={type}
          value={content}
          language={language}
          error={messageFor("content")}
          onChange={(value) => {
            setContent(value);
            clearFor("content");
          }}
        />
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
        error={messageFor("collectionIds")}
        disabled={saving}
        onChange={(ids) => {
          setCollectionIds(ids);
          clearFor("collectionIds");
        }}
      />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving || !canSubmit}>
          {progress !== null && progress < 1 ? "Uploading…" : saving ? "Creating…" : "Create item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TypePickerProps {
  value: CreatableType;
  disabled: boolean;
  /** False for Free accounts: File and Image stay visible but disabled, marked Pro. */
  canUpload: boolean;
  onChange: (slug: CreatableType) => void;
}

/** The types the dialog can create, as a row of radio buttons in each type's colour. */
function TypePicker({ value, disabled, canUpload, onChange }: TypePickerProps) {
  return (
    <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
      {TYPES.map(({ slug, label }) => {
        const Icon = typeIcons[slug];
        const color = typeColors[slug];
        const selected = slug === value;
        const proOnly = !canUpload && isUploadKind(slug);
        return (
          <Button
            key={slug}
            type="button"
            role="radio"
            aria-checked={selected}
            variant="ghost"
            size="sm"
            className={cn(selected && ["ring-1 ring-foreground/20", surfaceClasses[color]])}
            disabled={disabled || proOnly}
            title={proOnly ? "File and image uploads are a Pro feature." : undefined}
            onClick={() => onChange(slug)}
          >
            <Icon className={colorClasses[color]} aria-hidden />
            {label}
            {proOnly ? <span className="text-xs text-muted-foreground">Pro</span> : null}
          </Button>
        );
      })}
    </div>
  );
}

"use client";

import { Crown, FileInput, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, use, useId, useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { type CreatableType, createItem, type CreateItemField, type CreateItemInput } from "@/actions/items";
import { FillFromFileButton } from "@/components/items/FillFromFileButton";
import { FileUpload } from "@/components/items/FileUpload";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { isUploadKind } from "@/lib/files";
import type { FileFill } from "@/lib/import";
import {
  colorClasses,
  customTypeIcon,
  DEFAULT_CUSTOM_COLOR,
  hasContentField,
  hasLanguageField,
  hasUrlField,
  itemTypeFromSegment,
  surfaceClasses,
  toColorToken,
  typeColors,
  typeIcons,
  typeSegmentFromPathname,
} from "@/lib/item-type-ui";
import type { CustomTypeChoices, CustomTypeOption } from "@/lib/load-custom-types";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

/** The picker's order. Labels come from the `itemTypes` messages. */
const TYPES: { slug: CreatableType }[] = [
  { slug: "snippet" },
  { slug: "prompt" },
  { slug: "command" },
  { slug: "note" },
  { slug: "file" },
  { slug: "image" },
  { slug: "link" },
];

interface NewItemDialogProps {
  /** From the server's plan check; File and Image are disabled while it is false. */
  uploadsAllowed: Promise<boolean>;
  /** From the server's plan check; the Suggest Tags button is hidden while it is false. */
  aiAllowed: Promise<boolean>;
  /** The user's custom types, listed after the system ones; disabled once Pro has lapsed. */
  customTypes: Promise<CustomTypeChoices>;
  /** The button's text. The top bar's is "New Item"; type pages say "New Snippet" and so on. */
  label?: string;
  /** The top bar shows only the icon on narrow screens; the type pages always show the text. */
  iconOnlyOnMobile?: boolean;
}

/**
 * A "New Item" button and the dialog it opens: in the top bar, and on the type
 * pages, where the dialog starts on the page's type.
 */
export function NewItemDialog({ uploadsAllowed, aiAllowed, customTypes, label, iconOnlyOnMobile = true }: NewItemDialogProps) {
  const t = useTranslations("newItem");
  const tn = useTranslations("nav");
  const triggerLabel = label ?? tn("newItem");
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  return (
    // Kept open while saving, so a create in flight cannot be dismissed half done.
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : setOpen(next))}>
      <DialogTrigger render={<Button size="lg" aria-label={triggerLabel} />}>
        <Plus aria-hidden />
        {/* In the top bar, icon only on narrow screens, like "New Collection". */}
        <span className={cn(iconOnlyOnMobile && "hidden xl:inline")}>{triggerLabel}</span>
      </DialogTrigger>
      {/* Capped to the viewport and scrollable: a long snippet would push "Create item" off screen. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so it unmounts on close and every opening starts empty. */}
        <Suspense fallback={null}>
          <NewItemForm
            saving={saving}
            startSaving={startSaving}
            onCreated={() => setOpen(false)}
            uploadsAllowed={uploadsAllowed}
            aiAllowed={aiAllowed}
            customTypes={customTypes}
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
  customTypes: Promise<CustomTypeChoices>;
}

function NewItemForm({ saving, startSaving, onCreated, uploadsAllowed, aiAllowed, customTypes }: NewItemFormProps) {
  const t = useTranslations("newItem");
  const te = useTranslations("errors.upload");
  const tf = useTranslations("itemForm");
  const tc = useTranslations("common");
  const tTypes = useTranslations("itemTypes");
  const canUpload = use(uploadsAllowed);
  const custom = use(customTypes);
  const router = useRouter();
  const id = useId();
  const { setError, isInvalid, messageFor, clearFor, fieldProps } = useFieldErrors<CreateItemField>(id);

  // Starts on the type of the listing page it was opened from, when that type can be created here.
  const pageSegment = typeSegmentFromPathname(usePathname());
  const pageType = pageSegment ? itemTypeFromSegment(pageSegment) : null;
  const [pageCustomType] = useState(() =>
    custom.canCreate ? (custom.types.find(({ slug }) => slug === pageSegment) ?? null) : null,
  );
  const [type, setType] = useState<CreatableType>(
    () => TYPES.find(({ slug }) => slug === pageType && (canUpload || !isUploadKind(slug)))?.slug ?? "snippet",
  );
  /** Set when a custom type is picked; `type` is then ignored. */
  const [customTypeId, setCustomTypeId] = useState<string | null>(pageCustomType?.id ?? null);
  const customType = custom.types.find(({ id: typeId }) => typeId === customTypeId) ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  /** A file read while content was already typed, waiting for the user to confirm the replace. */
  const [pendingFill, setPendingFill] = useState<FileFill | null>(null);

  // A custom type is a text type: a note's Markdown content, plus a language.
  const fieldsSlug = customType ? "note" : type;
  const hasContent = hasContentField(fieldsSlug);
  const hasLanguage = customType !== null || hasLanguageField(fieldsSlug);
  const hasUrl = hasUrlField(fieldsSlug);
  const fields = useItemFields({
    initial: {
      title: "",
      description: "",
      tags: "",
      collectionIds: [],
      content: pageCustomType?.template ?? "",
      language: "",
      url: "",
    },
    hasContent,
    hasLanguage,
    hasUrl,
    onTagAccepted: () => clearFor("tags"),
  });
  const { title, setTitle, description, setDescription, tags, setTags, collectionIds, setCollectionIds } = fields;
  const { content, setContent, language, setLanguage, url, setUrl, tagSuggestions } = fields;
  const secretCheck = useSecretCheck();
  const uploadKind = !customType && isUploadKind(type) ? type : null;
  const canSubmit = fields.canSubmit && (!uploadKind || file !== null);

  /**
   * Fills the form from a file, keeping the chosen type: the title only when empty, the
   * content, and the language when the type has one and the extension names it.
   */
  function applyFill(fill: FileFill) {
    if (!title.trim()) {
      setTitle(fill.title);
      clearFor("title");
    }
    setContent(fill.content);
    clearFor("content");
    if (hasLanguage && fill.language) {
      setLanguage(fill.language);
      clearFor("language");
    }
  }

  /** Typed content is replaced only after a confirm; an empty one, or the untouched template, at once. */
  function handleFill(fill: FileFill) {
    const untouched = !content.trim() || (customType?.template != null && content === customType.template);
    if (untouched) applyFill(fill);
    else setPendingFill(fill);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || saving) return;

    // Only the fields this type shows: text typed under another type is not sent.
    const input: CreateItemInput = {
      ...(customType ? { type: "custom", typeId: customType.id } : { type }),
      ...fields.input,
    };
    secretCheck.check(fields.secretFields, "save", () => save(input));
  }

  function save(input: CreateItemInput) {
    startSaving(async () => {
      if (uploadKind && file) {
        setProgress(0);
        try {
          input.fileKey = await uploadFile(uploadKind, file, setProgress, { failed: te("failed"), network: te("network") });
        } catch (uploadError) {
          setProgress(null);
          const message = uploadError instanceof Error ? uploadError.message : t("uploadFailed");
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

      toast.success(t("created"));
      onCreated();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      {secretCheck.dialog}
      <TypePicker
        value={type}
        customValue={customTypeId}
        disabled={saving}
        canUpload={canUpload}
        custom={custom}
        onChange={(slug) => {
          // A file chosen as one kind is not valid as the other.
          if (slug !== type || customTypeId) setFile(null);
          setType(slug);
          setCustomTypeId(null);
          setError(null);
        }}
        onCustomChange={(option) => {
          setFile(null);
          setCustomTypeId(option.id);
          // The template fills the content only while nothing has been typed there.
          if (!content.trim() && option.template) setContent(option.template);
          setError(null);
        }}
      />

      <Field id={`${id}-title`} label={tf("title")} error={messageFor("title")}>
        <Input value={title} autoFocus {...fieldProps("title", setTitle)} />
      </Field>

      <Field
        id={`${id}-description`}
        label={tf("description")}
        error={messageFor("description")}
        action={
          <GenerateDescriptionButton
            aiAllowed={aiAllowed}
            disabled={saving}
            // A custom type's name tells the model more than "note".
            input={fields.descriptionInput(customType ? customType.name : type, uploadKind ? (file?.name ?? null) : null)}
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
        <Field id={`${id}-fileKey`} label={tTypes(`${uploadKind}.one`)} error={messageFor("fileKey")}>
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
        <Field id={`${id}-url`} label={tf("url")} error={messageFor("url")}>
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
          slug={fieldsSlug}
          value={content}
          language={language}
          error={messageFor("content")}
          onChange={(value) => {
            setContent(value);
            clearFor("content");
          }}
          action={<FillFromFileButton withLanguage={hasLanguage} disabled={saving} onFill={handleFill} />}
        />
      ) : null}

      <AlertDialog open={pendingFill !== null} onOpenChange={(next) => !next && setPendingFill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("replaceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("replaceBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (pendingFill) applyFill(pendingFill);
                setPendingFill(null);
              }}
            >
              {t("replace")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Bulk import lives in Settings › Data. `onCreated` only closes the dialog, which stays
          mounted in the top bar across navigations. Inert while saving: closing here would get
          past the dialog's own guard and leave with a create in flight. */}
      <Link
        href="/settings#data"
        onClick={(event) => {
          if (saving) event.preventDefault();
          else onCreated();
        }}
        aria-disabled={saving || undefined}
        tabIndex={saving ? -1 : undefined}
        className={cn(
          "flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
          saving && "pointer-events-none opacity-50",
        )}
      >
        <FileInput className="size-3.5" aria-hidden />
        {t("importSeveral")}
      </Link>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />} disabled={saving}>
          {tc("cancel")}
        </DialogClose>
        <Button type="submit" disabled={saving || !canSubmit}>
          {progress !== null && progress < 1 ? t("uploading") : saving ? t("creating") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TypePickerProps {
  value: CreatableType;
  /** The picked custom type's id; when set, it is the selection rather than `value`. */
  customValue: string | null;
  disabled: boolean;
  /** False for Free accounts: File and Image stay visible but disabled, marked Pro. */
  canUpload: boolean;
  custom: CustomTypeChoices;
  onChange: (slug: CreatableType) => void;
  onCustomChange: (option: CustomTypeOption) => void;
}

/** The types the dialog can create, as a row of radio buttons in each type's colour; custom ones after a line. */
function TypePicker({ value, customValue, disabled, canUpload, custom, onChange, onCustomChange }: TypePickerProps) {
  const t = useTranslations("newItem");
  const tTypes = useTranslations("itemTypes");
  return (
    <div role="radiogroup" aria-label={t("typePicker")} className="flex flex-wrap gap-1.5">
      {TYPES.map(({ slug }) => {
        const Icon = typeIcons[slug];
        const color = typeColors[slug];
        const selected = customValue === null && slug === value;
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
            title={proOnly ? t("uploadsProOnly") : undefined}
            onClick={() => onChange(slug)}
          >
            <Icon className={colorClasses[color]} aria-hidden />
            {tTypes(`${slug}.one`)}
            {proOnly ? <span className="text-xs text-muted-foreground">{t("pro")}</span> : null}
          </Button>
        );
      })}

      {custom.types.length > 0 ? (
        <>
          <Separator className="my-1 basis-full" />
          {custom.types.map((option) => {
            const Icon = customTypeIcon(option.icon);
            const color = toColorToken(option.color) ?? DEFAULT_CUSTOM_COLOR;
            const selected = option.id === customValue;
            return (
              <Button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                variant="ghost"
                size="sm"
                className={cn(selected && ["ring-1 ring-foreground/20", surfaceClasses[color]])}
                disabled={disabled || !custom.canCreate}
                title={custom.canCreate ? undefined : t("customProOnly")}
                onClick={() => onCustomChange(option)}
              >
                <Icon className={colorClasses[color]} aria-hidden />
                {/* The author's own name, never translated. */}
                {option.name}
                {custom.canCreate ? null : <Crown className="text-amber-400" aria-hidden />}
              </Button>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

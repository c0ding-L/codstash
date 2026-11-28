"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, use, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateAutoTags } from "@/actions/ai";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toTags } from "@/lib/tags";

interface TagSuggestionsInput {
  title: string;
  /** The form's content, or null for a type without one. */
  content: string | null;
  /** The tags input as typed: comma-separated. */
  tags: string;
  /** Adds the tag to the form's tags. Nothing is saved until the form is. */
  onAccept: (tag: string) => void;
}

/** The state shared by the Suggest Tags button and the suggestions under the input. */
export function useTagSuggestions({ title, content, tags, onAccept }: TagSuggestionsInput) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Disables the button while a request runs, so a double click does not spend two.
  const [pending, startTransition] = useTransition();
  const secretCheck = useSecretCheck();

  function suggest() {
    // The same fields the request sends: the title and the content.
    secretCheck.check({ title, content }, "ai", request);
  }

  function request() {
    startTransition(async () => {
      const result = await generateAutoTags({ title, content, tags: toTags(tags) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.data);
    });
  }

  const dismiss = (tag: string) => setSuggestions((current) => current.filter((other) => other !== tag));
  const accept = (tag: string) => {
    onAccept(tag);
    dismiss(tag);
  };

  return { suggestions, pending, canSuggest: title.trim() !== "", suggest, accept, dismiss, secretDialog: secretCheck.dialog };
}

export type TagSuggestions = ReturnType<typeof useTagSuggestions>;

interface SuggestTagsProps {
  /** From the server's plan check; nothing shows while it is false. */
  aiAllowed: Promise<boolean>;
  state: TagSuggestions;
  /** While the form saves. */
  disabled: boolean;
}

/**
 * The "Suggest Tags" button, at the right of the Tags label. Pro only, behind
 * its own Suspense boundary, so waiting for the plan never holds the form back.
 */
export function SuggestTagsButton({ aiAllowed, state, disabled }: SuggestTagsProps) {
  const t = useTranslations("ai");
  return (
    <AiFieldButton
      aiAllowed={aiAllowed}
      label={t("suggestTags")}
      pendingLabel={t("suggesting")}
      pending={state.pending}
      disabled={disabled}
      canRun={state.canSuggest}
      onClick={state.suggest}
      dialog={state.secretDialog}
    />
  );
}

interface AiFieldButtonProps {
  /** From the server's plan check; nothing shows while it is false. */
  aiAllowed: Promise<boolean>;
  label: string;
  pendingLabel: string;
  pending: boolean;
  /** While the form saves. */
  disabled: boolean;
  /** False until the form has a title: the button says so. */
  canRun: boolean;
  onClick: () => void;
  /** The secret check's dialog, rendered beside the button. */
  dialog: React.ReactNode;
}

/**
 * A small AI button beside a form field's label. Pro only, behind its own Suspense boundary,
 * so waiting for the plan never holds the form back.
 */
export function AiFieldButton({ aiAllowed, label, pendingLabel, pending, disabled, canRun, onClick, dialog }: AiFieldButtonProps) {
  const t = useTranslations("ai");
  return (
    <Suspense fallback={null}>
      <ShownIf allowed={aiAllowed}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={pending || disabled || !canRun}
          title={canRun ? undefined : t("addTitleFirst")}
          onClick={onClick}
        >
          <Sparkles aria-hidden />
          {pending ? pendingLabel : label}
        </Button>
        {dialog}
      </ShownIf>
    </Suspense>
  );
}

/** Its children once the plan check allows AI; nothing otherwise. */
export function ShownIf({ allowed, children }: { allowed: Promise<boolean>; children: React.ReactNode }) {
  return use(allowed) ? children : null;
}

/** Under the tags input: the suggestions, to accept or dismiss one by one. Empty until the button is used. */
export function TagSuggestionList({ state, disabled }: Omit<SuggestTagsProps, "aiAllowed">) {
  const t = useTranslations("ai");
  if (state.suggestions.length === 0) return null;
  return (
    <ul aria-label={t("suggestedTags")} className="flex flex-wrap gap-1">
      {state.suggestions.map((tag) => (
        <li key={tag}>
          <Badge variant="outline" className="pr-0.5 text-blue-400">
            {tag}
            <button
              type="button"
              className="rounded-full p-0.5 text-emerald-400 hover:bg-foreground/10 disabled:pointer-events-none"
              aria-label={t("addTag", { tag })}
              disabled={disabled}
              onClick={() => state.accept(tag)}
            >
              <Check className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              className="rounded-full p-0.5 text-red-400 hover:bg-foreground/10 disabled:pointer-events-none"
              aria-label={t("dismissTag", { tag })}
              disabled={disabled}
              onClick={() => state.dismiss(tag)}
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, use, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateAutoTags } from "@/actions/ai";
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

  function suggest() {
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

  return { suggestions, pending, canSuggest: title.trim() !== "", suggest, accept, dismiss };
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
    <Suspense fallback={null}>
      <ShownIf allowed={aiAllowed}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={state.pending || disabled || !state.canSuggest}
          title={state.canSuggest ? undefined : t("addTitleFirst")}
          onClick={state.suggest}
        >
          <Sparkles aria-hidden />
          {state.pending ? t("suggesting") : t("suggestTags")}
        </Button>
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

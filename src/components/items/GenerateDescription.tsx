"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useTransition } from "react";
import { toast } from "sonner";

import { generateDescription, type DescriptionInput } from "@/actions/ai";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { ShownIf } from "@/components/items/SuggestTags";
import { Button } from "@/components/ui/button";

interface GenerateDescriptionProps {
  /** From the server's plan check; nothing shows while it is false. */
  aiAllowed: Promise<boolean>;
  /** The form's current fields, saved or not: only the ones its type has. */
  input: DescriptionInput;
  /** Puts the description in the form, replacing what is there. Nothing is saved until the form is. */
  onGenerated: (description: string) => void;
  /** While the form saves. */
  disabled: boolean;
}

/**
 * The "Generate Description" button at the right of the Description label. Pro only, behind its
 * own Suspense boundary, so waiting for the plan never holds the form back.
 */
export function GenerateDescriptionButton({ aiAllowed, input, onGenerated, disabled }: GenerateDescriptionProps) {
  // Disables the button while a request runs, so a double click does not spend two.
  const t = useTranslations("ai");
  const [pending, startTransition] = useTransition();
  const canGenerate = input.title.trim() !== "";
  const secretCheck = useSecretCheck();

  function generate() {
    // The text fields the request sends.
    secretCheck.check({ title: input.title, content: input.content, url: input.url }, "ai", request);
  }

  function request() {
    startTransition(async () => {
      const result = await generateDescription(input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onGenerated(result.data);
    });
  }

  return (
    <Suspense fallback={null}>
      <ShownIf allowed={aiAllowed}>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={pending || disabled || !canGenerate}
          title={canGenerate ? undefined : t("addTitleFirst")}
          onClick={generate}
        >
          <Sparkles aria-hidden />
          {pending ? t("generating") : t("generateDescription")}
        </Button>
        {secretCheck.dialog}
      </ShownIf>
    </Suspense>
  );
}

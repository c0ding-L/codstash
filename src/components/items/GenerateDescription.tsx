"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { generateDescription, type DescriptionInput } from "@/actions/ai";
import { useSecretCheck } from "@/components/items/SecretWarningDialog";
import { AiFieldButton } from "@/components/items/SuggestTags";

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
    <AiFieldButton
      aiAllowed={aiAllowed}
      label={t("generateDescription")}
      pendingLabel={t("generating")}
      pending={pending}
      disabled={disabled}
      canRun={canGenerate}
      onClick={generate}
      dialog={secretCheck.dialog}
    />
  );
}

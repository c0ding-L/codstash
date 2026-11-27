"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import type { ImportConflict } from "@/lib/import";

/** What to do with an item whose title and type already exist: skip it or import a copy. */
export function ImportConflictChoice({
  value,
  onChange,
  disabled,
}: {
  value: ImportConflict;
  onChange: (value: ImportConflict) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("settings.import");
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{t("conflictLabel")}</legend>
      {(["skip", "duplicate"] as const).map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="accent-primary"
          />
          {t(option === "skip" ? "conflictSkip" : "conflictDuplicate")}
        </label>
      ))}
    </fieldset>
  );
}

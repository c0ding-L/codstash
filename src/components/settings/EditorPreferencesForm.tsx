"use client";

import { useId } from "react";

import { useEditorPreferences, useSaveEditorPreferences } from "@/components/editor/EditorPreferencesContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EDITOR_THEME_LABELS,
  EDITOR_THEMES,
  FONT_SIZES,
  TAB_SIZES,
  type EditorPreferences,
} from "@/lib/editor-preferences";

const FONT_SIZE_ITEMS = FONT_SIZES.map((size) => ({ value: size, label: `${size}px` }));
const TAB_SIZE_ITEMS = TAB_SIZES.map((size) => ({ value: size, label: `${size} spaces` }));
const THEME_ITEMS = EDITOR_THEMES.map((theme) => ({ value: theme, label: EDITOR_THEME_LABELS[theme] }));

/** Each control saves on change; the context shows the change at once and toasts the result. */
export function EditorPreferencesForm() {
  const preferences = useEditorPreferences();
  const save = useSaveEditorPreferences();

  const change = <K extends keyof EditorPreferences>(key: K, value: EditorPreferences[K]) => {
    if (preferences[key] !== value) save({ ...preferences, [key]: value });
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      <SelectRow
        label="Font size"
        items={FONT_SIZE_ITEMS}
        value={preferences.fontSize}
        onChange={(value) => change("fontSize", value)}
      />
      <SelectRow
        label="Tab size"
        items={TAB_SIZE_ITEMS}
        value={preferences.tabSize}
        onChange={(value) => change("tabSize", value)}
      />
      <SelectRow
        label="Theme"
        items={THEME_ITEMS}
        value={preferences.theme}
        onChange={(value) => change("theme", value)}
      />
      <SwitchRow
        label="Word wrap"
        description="Wrap long lines instead of scrolling sideways."
        checked={preferences.wordWrap}
        onChange={(checked) => change("wordWrap", checked)}
      />
      <SwitchRow
        label="Minimap"
        description="Show the code overview along the editor's right edge."
        checked={preferences.minimap}
        onChange={(checked) => change("minimap", checked)}
      />
    </div>
  );
}

interface SelectRowProps<T extends string | number> {
  label: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function SelectRow<T extends string | number>({ label, items, value, onChange }: SelectRowProps<T>) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <label id={id} className="text-sm font-medium">
        {label}
      </label>
      <Select items={items} value={value} onValueChange={(next) => next !== null && onChange(next)}>
        <SelectTrigger aria-labelledby={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ label, description, checked, onChange }: SwitchRowProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

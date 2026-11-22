"use client";

import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { updateEditorPreferences } from "@/actions/editor-preferences";
import type { EditorPreferences } from "@/lib/editor-preferences";

interface EditorPreferencesContextValue {
  /** Started by the layout and not awaited there, so the shell never waits on it. */
  loaded: Promise<EditorPreferences>;
  /** Set once the user changes something; it wins over `loaded` from then on. */
  current: EditorPreferences | null;
  save: (next: EditorPreferences) => void;
}

const EditorPreferencesContext = createContext<EditorPreferencesContextValue | null>(null);

const TOAST_ID = "editor-preferences";

export function EditorPreferencesProvider({
  preferences,
  children,
}: {
  preferences: Promise<EditorPreferences>;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<EditorPreferences | null>(null);
  // Only the latest save may roll back: an older one failing must not undo a newer change.
  const latestSave = useRef(0);

  const save = useCallback((next: EditorPreferences) => {
    const saveId = ++latestSave.current;
    let previous: EditorPreferences | null = null;
    setCurrent((value) => {
      previous = value;
      return next;
    });

    void updateEditorPreferences(next)
      .catch(() => ({ success: false, error: "Could not save your editor preferences. Try again." }))
      .then((result) => {
        if (result.success) {
          toast.success("Editor preferences saved.", { id: TOAST_ID });
          return;
        }
        if (saveId === latestSave.current) setCurrent(previous);
        toast.error(result.error ?? "Could not save your editor preferences.", { id: TOAST_ID });
      });
  }, []);

  const value = useMemo(() => ({ loaded: preferences, current, save }), [preferences, current, save]);

  return <EditorPreferencesContext value={value}>{children}</EditorPreferencesContext>;
}

function useEditorPreferencesContext() {
  const context = use(EditorPreferencesContext);
  if (!context) throw new Error("useEditorPreferences must be used inside EditorPreferencesProvider.");
  return context;
}

/** Suspends until the saved preferences have loaded, so put a Suspense boundary above the caller. */
export function useEditorPreferences(): EditorPreferences {
  const { loaded, current } = useEditorPreferencesContext();
  return current ?? use(loaded);
}

/** Applies the change at once and saves it in the background, with a toast either way. */
export function useSaveEditorPreferences() {
  return useEditorPreferencesContext().save;
}

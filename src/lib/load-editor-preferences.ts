import { getEditorPreferences } from "@/lib/db/profile";
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/lib/editor-preferences";
import { loadForUser } from "@/lib/load-for-user";

/**
 * The signed-in user's editor preferences, for the `(app)` layout to stream to the editors.
 * A failed read falls back to the defaults, as an editor would otherwise throw where it
 * reads the result.
 */
export async function loadEditorPreferences(): Promise<EditorPreferences> {
  return loadForUser(getEditorPreferences, DEFAULT_EDITOR_PREFERENCES, "editor preferences");
}
